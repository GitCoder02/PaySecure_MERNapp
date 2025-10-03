// models/Transaction.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const transactionSchema = new mongoose.Schema({
  userId: { // sender (customer)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: { // receiver (merchant)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  type: {
    type: String,
    enum: ['UPI', 'Bank'],
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Pending',
  },
  pin: {
    type: String,
    required: true,
  },
  hmac: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Verify HMAC
transactionSchema.methods.verifyHmac = function (secret) {
  const data = `${this.userId}:${this.receiverId}:${this.amount}:${this.type}:${this.pin}`;
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  return this.hmac === generatedHmac;
};

module.exports = mongoose.model('Transaction', transactionSchema);