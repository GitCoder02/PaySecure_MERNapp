const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const bankAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bankUsername: { type: String, required: true }, // can be unique per user
  bankPassword: { type: String, required: true }, // hashed with bcrypt
  accountNumber: { type: String, required: true },
  phone: { type: String, required: true }, // mandatory for OTP
  balance: { type: Number, default: 10000 }, // demo balance
}, { timestamps: true });

// Hash bank password before save
bankAccountSchema.pre('save', async function(next) {
  try {
    if (this.isModified('bankPassword')) {
      const salt = await bcrypt.genSalt(10);
      this.bankPassword = await bcrypt.hash(this.bankPassword, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

bankAccountSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.bankPassword);
};

module.exports = mongoose.model('BankAccount', bankAccountSchema);