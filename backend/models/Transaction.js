// backend/models/Transaction.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ["UPI", "Bank", "Card"], required: true },
  status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Pending" },
  pin: { type: String, required: true },
  hmac: { type: String, required: true },
  signature: { type: String },
  // Risk fields
  riskScore: { type: Number, default: 0 },
  riskReasons: { type: [String], default: [] },
  riskEvaluatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// canonical helper
transactionSchema.methods.canonicalString = function () {
  return `${this.userId}:${this.receiverId}:${this.amount}:${this.createdAt.getTime()}`;
};

transactionSchema.methods.verifyHmac = function (secret) {
  const data = `${this.userId}:${this.receiverId}:${this.amount}:${this.type}:${this.pin}`;
  const generatedHmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return this.hmac === generatedHmac;
};

module.exports = mongoose.model("Transaction", transactionSchema);
