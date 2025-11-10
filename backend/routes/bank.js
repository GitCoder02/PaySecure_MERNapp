const express = require('express');
const router = express.Router();
const BankAccount = require('../models/BankAccount');
const authMiddleware = require('../middleware/auth');
const { bankAddLimiter } = require('../middleware/rateLimiter');  

// Add a bank account (user adds their bank credentials for demo)
router.post('/add', authMiddleware, bankAddLimiter, async (req, res) => {
  try {
    const { bankUsername, bankPassword, accountNumber, phone, balance } = req.body;
    if (!bankUsername || !bankPassword || !accountNumber || !phone) {
      return res.status(400).json({ message: 'All fields (bankUsername, bankPassword, accountNumber, phone) are required' });
    }

    // Optionally ensure same user doesn't add duplicate bankUsername
    const exists = await BankAccount.findOne({ userId: req.user.id, bankUsername });
    if (exists) {
      return res.status(400).json({ message: 'Bank username already added' });
    }

    const bank = new BankAccount({
      userId: req.user.id,
      bankUsername,
      bankPassword,
      accountNumber,
      phone,
      balance: typeof balance === 'number' ? balance : 10000
    });
    await bank.save();
    res.status(201).json({ message: 'Bank account added', bankId: bank._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add bank account' });
  }
});

// Get current user's bank accounts
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const banks = await BankAccount.find({ userId: req.user.id }).select('-bankPassword');
    res.json({ banks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch bank accounts' });
  }
});

module.exports = router;