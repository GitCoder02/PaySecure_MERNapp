// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const adminMiddleware = require("../middleware/adminMiddleware");
const Transaction = require("../models/Transaction");
const Audit = require("../models/Audit");
const { verifySignature } = require("../utils/signatures");
const User = require("../models/User");


/* =====================================================
   GET all transactions (Admin only) with optional filters
===================================================== */
router.get("/transactions", adminMiddleware, async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const transactions = await Transaction.find(filter)
      .populate("userId", "name email")
      .populate("receiverId", "name email")
      .sort({ createdAt: -1 });

    // Audit admin view
    await Audit.create({
      userId: req.user._id,
      action: "ADMIN_VIEW_TRANSACTIONS",
      meta: { totalFetched: transactions.length },
    });

    res.json({ count: transactions.length, transactions });
  } catch (err) {
    console.error("Admin Transactions Error:", err);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

/* =====================================================
   GET all audit logs (Admin only)
===================================================== */
router.get("/audit", adminMiddleware, async (req, res) => {
  try {
    const logs = await Audit.find()
      .populate("userId", "name email role")
      .sort({ timestamp: -1 })
      .limit(200);

    await Audit.create({
      userId: req.user._id,
      action: "ADMIN_VIEW_AUDIT",
      meta: { viewed: logs.length },
    });

    res.json({ count: logs.length, logs });
  } catch (err) {
    console.error("Fetch Audit Error:", err);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

/* =====================================================
   Verify signature manually (Admin cross-check)
===================================================== */
router.get("/verify/:id", adminMiddleware, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    // 🛡️ Guard: if no signature field, return graceful response
    if (!tx.signature) {
      return res.status(200).json({
        transactionId: tx._id,
        isValid: false,
        message: "⚠️ No digital signature found for this transaction.",
      });
    }

    const canonical = `${tx.userId}:${tx.receiverId}:${tx.amount}:${tx.createdAt.getTime()}`;
    const isValid = verifySignature(canonical, tx.signature);

    res.json({
      transactionId: tx._id,
      isValid,
      message: isValid
        ? "✅ Signature verified by admin"
        : "❌ Signature invalid or tampered",
    });
  } catch (err) {
    console.error("Admin Verify Signature Error:", err);
    res.status(500).json({ message: "Signature verification failed" });
  }
});

/* ============================================
   GET all users (admin) - paginated
============================================ */
router.get("/users", adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const users = await User.find({})
      .select("-password -pin -twoFactorSecret")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({ count: users.length, total, users });
  } catch (err) {
    console.error("Fetch Users Error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* ============================================
   PATCH user (update role or block/unblock)
   Body: { role?: "user"|"merchant"|"admin", isBlocked?: true|false }
============================================ */
router.patch("/users/:id", adminMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (req.body.role) updates.role = req.body.role;
    if (typeof req.body.isBlocked !== "undefined") updates.isBlocked = !!req.body.isBlocked;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password -pin -twoFactorSecret");
    if (!user) return res.status(404).json({ message: "User not found" });

    await Audit.create({
      userId: req.user._id,
      action: "ADMIN_UPDATE_USER",
      meta: { targetUserId: req.params.id, updates },
    });

    res.json({ message: "User updated", user });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

/* ============================================
   DELETE user
============================================ */
router.delete("/users/:id", adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await Audit.create({
      userId: req.user._id,
      action: "ADMIN_DELETE_USER",
      meta: { targetUserId: req.params.id },
    });

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});


/* =====================================================
   Verify audit log integrity (admin only)
===================================================== */
router.get("/verify-audit-chain", adminMiddleware, async (req, res) => {
  try {
    const logs = await Audit.find().sort({ timestamp: 1 });

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      const expectedPrevHash = prev.hash;

      if (curr.previousHash !== expectedPrevHash) {
        return res.status(200).json({
          valid: false,
          message: `❌ Chain broken between log ${i - 1} and ${i}`,
          brokenAt: {
            prevAction: prev.action,
            currentAction: curr.action,
            timestamp: curr.timestamp,
          },
        });
      }
    }

    res.status(200).json({
      valid: true,
      message: "✅ All audit logs verified successfully. Chain intact.",
      totalLogs: logs.length,
    });
  } catch (err) {
    console.error("Audit Chain Verify Error:", err);
    res.status(500).json({ message: "Failed to verify audit chain" });
  }
});


module.exports = router;
