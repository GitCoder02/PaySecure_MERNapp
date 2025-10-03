// routes/payment.js
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/adminMiddleware');
const crypto = require('crypto');
const User = require('../models/User');  // 👈 Add this

// AES Encryption (with consistent key from .env)
function encrypt(pin) {
  const algorithm = "aes-256-gcm";

  // Ensure the key is exactly 32 bytes
  let key = Buffer.from(process.env.AES_SECRET_KEY, "utf8");
  if (key.length !== 32) {
    throw new Error("AES_SECRET_KEY must be exactly 32 bytes long");
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(pin, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return { encrypted, iv: iv.toString("hex"), authTag };
}

// ✅ Make a Payment
router.post('/pay', authMiddleware, async (req, res) => {
  const { amount, type, pin, receiverId } = req.body;

  if (!amount || !type || !pin || !receiverId) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Fetch sender and receiver
    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(400).json({ message: 'Invalid merchant' });
    }

    // ✅ Check if PIN matches sender's stored PIN
    const isPinValid = await sender.comparePin(pin);
    if (!isPinValid) {
      return res.status(400).json({ message: 'Invalid PIN' });
    }

    // Encrypt PIN for storage (not verification)
    const { encrypted } = encrypt(pin);

    // HMAC
    const data = `${req.user.id}:${receiverId}:${amount}:${type}:${encrypted}`;
    const hmac = crypto
      .createHmac('sha256', process.env.HMAC_SECRET || 'defaultsecret')
      .update(data)
      .digest('hex');

    // Create transaction
    const transaction = new Transaction({
      userId: req.user.id,
      receiverId,
      amount,
      type,
      pin: encrypted, // encrypted for record (demo purposes)
      hmac,
      status: "Pending"
    });

    // Balance check
    if (sender.balance >= amount) {
      sender.balance -= amount;
      receiver.balance += amount;

      transaction.status = "Success";

      await sender.save();
      await receiver.save();
    } else {
      transaction.status = "Failed";
    }

    await transaction.save();

    res.status(201).json({
      message:
        transaction.status === "Success"
          ? "Payment successful"
          : "Insufficient balance",
      transactionId: transaction._id,
      status: transaction.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Payment processing failed' });
  }
});

// ✅ Get Received Transactions (Merchant)
router.get('/received', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ receiverId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('userId', 'name'); // show customer name

    res.json({ message: 'Received transactions', transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch received payments' });
  }
});

// ✅ Get Transaction History (for a User)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('receiverId', 'name'); // 👈 now merchant name will show

    res.json({ message: 'Transaction history', transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

// ✅ Get All Transactions (Admin only)
router.get('/all', adminMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name')      // sender name
      .populate('receiverId', 'name'); // merchant name

    res.json({ message: 'All transactions (Admin)', transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch all transactions' });
  }
});

module.exports = router;