// backend/models/Audit.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const auditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      "USER_REGISTER",
      "USER_LOGIN_SUCCESS",
      "TRANSACTION_SUCCESS",
      "SIGNATURE_VERIFIED",
      "ADMIN_VIEW_TRANSACTIONS",
      "ADMIN_VIEW_AUDIT",
      "ADMIN_UPDATE_USER",
      "ADMIN_DELETE_USER",
    ],
  },
  meta: {
    type: Object,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // 🔐 New fields for integrity protection
  previousHash: {
    type: String,
    default: "GENESIS",
  },
  hash: {
    type: String,
  },
});

/**
 * Pre-save hook to compute SHA-256 hash chain
 * Each log’s hash = SHA256(userId + action + meta + previousHash + timestamp)
 */
auditSchema.pre("save", async function (next) {
  try {
    // Get previous audit entry
    const lastLog = await this.constructor.findOne().sort({ timestamp: -1 });
    this.previousHash = lastLog ? lastLog.hash : "GENESIS";

    // Prepare data string
    const dataString = JSON.stringify({
      userId: this.userId?.toString(),
      action: this.action,
      meta: this.meta,
      previousHash: this.previousHash,
      timestamp: this.timestamp,
    });

    // Compute SHA256
    this.hash = crypto.createHash("sha256").update(dataString).digest("hex");
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Audit", auditSchema);
