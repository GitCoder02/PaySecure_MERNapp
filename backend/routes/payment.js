const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/adminMiddleware');
const BankAccount = require('../models/BankAccount');
const crypto = require('crypto');
const User = require('../models/User');

// AES Encryption (for PIN only)
function encrypt(pin) {
  const algorithm = "aes-256-gcm";
  let key = Buffer.from(process.env.AES_SECRET_KEY, "utf8");
  if (key.length !== 32) throw new Error("AES_SECRET_KEY must be exactly 32 bytes long");

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(pin, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), authTag };
}

// Luhn algorithm for card validation
function isValidCardNumber(cardNumber) {
  let sum = 0, shouldDouble = false;
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i]);
    if (shouldDouble) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// 💳 /api/payment/pay
router.post('/pay', authMiddleware, async (req, res) => {
  const {
    amount,
    type,
    pin,
    receiverId,
    cardNumber,
    expiryMonth,
    expiryYear,
    cvv,
    saveCard,
    bankUsername,
    bankPassword,
    otp,
  } = req.body;

  if (!amount || !type || !receiverId)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(400).json({ message: "Invalid merchant" });

    let encryptedPin = "";
    let transactionStatus = "Pending";

    // ---------------- UPI FLOW ----------------
    if (type === "UPI") {
      if (!pin) return res.status(400).json({ message: "PIN required for UPI" });
      const isPinValid = await sender.comparePin(pin);
      if (!isPinValid)
        return res.status(400).json({ message: "Invalid UPI PIN. Please try again." });

      const { encrypted } = encrypt(pin);
      encryptedPin = encrypted;

      if (sender.balance < amount)
        return res.status(400).json({ message: "Insufficient wallet balance" });

      sender.balance -= amount;
      receiver.balance += amount;
      transactionStatus = "Success";
    }

    // ---------------- CARD FLOW ----------------
    else if (type === "Card") {
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv)
        return res.status(400).json({ message: "All card fields are required" });

      if (!/^\d{16}$/.test(cardNumber))
        return res.status(400).json({ message: "Card number must be 16 digits" });
      if (!(expiryMonth >= 1 && expiryMonth <= 12))
        return res.status(400).json({ message: "Invalid expiry month" });
      if (!(expiryYear >= new Date().getFullYear()))
        return res.status(400).json({ message: "Invalid expiry year" });
      if (!/^\d{3}$/.test(cvv))
        return res.status(400).json({ message: "CVV must be 3 digits" });

      if (sender.balance < amount)
        return res.status(400).json({ message: "Insufficient wallet balance" });

      encryptedPin = "N/A"; // not stored for card
      sender.balance -= amount;
      receiver.balance += amount;
      transactionStatus = "Success";

      if (saveCard) {
        sender.cardLast4 = cardNumber.slice(-4);
        sender.cardExpiryMonth = expiryMonth;
        sender.cardExpiryYear = expiryYear;
        await sender.save();
      }
    }

    // ---------------- BANK FLOW ----------------
    else if (type === "Bank") {
      const bankAccount = await BankAccount.findOne({ userId: req.user.id });
      if (!bankAccount)
        return res.status(400).json({ message: "No linked bank account found" });

      // 1️⃣ Verify bank username/password
      if (!bankUsername || !bankPassword)
        return res.status(400).json({ message: "Bank username & password required" });

      const bcrypt = require("bcryptjs");
      const validPassword = await bcrypt.compare(bankPassword, bankAccount.passwordHash);
      if (bankUsername !== bankAccount.username || !validPassword)
        return res.status(400).json({ message: "Invalid bank credentials" });

      // 2️⃣ Verify OTP (simulate check)
      if (!otp)
        return res.status(400).json({ message: "OTP required for bank transfer" });
      if (otp !== bankAccount.lastOtp)
        return res.status(400).json({ message: "Invalid OTP" });

      // 3️⃣ Balance check and transfer
      if (bankAccount.balance < amount)
        return res.status(400).json({ message: "Insufficient bank balance" });

      bankAccount.balance -= amount;
      receiver.balance += amount;
      await bankAccount.save();
      transactionStatus = "Success";
    }

    // ---------------- INVALID TYPE ----------------
    else {
      return res.status(400).json({ message: "Invalid payment type" });
    }

    // HMAC for transaction integrity
    const data = `${req.user.id}:${receiverId}:${amount}:${type}:${encryptedPin}`;
    const hmac = crypto
      .createHmac("sha256", process.env.HMAC_SECRET || "defaultsecret")
      .update(data)
      .digest("hex");

    // Save transaction
    const transaction = new Transaction({
      userId: req.user.id,
      receiverId,
      amount,
      type,
      pin: encryptedPin,
      hmac,
      status: transactionStatus,
    });

    await sender.save();
    await receiver.save();
    await transaction.save();

    res.status(201).json({
      message: "Payment successful",
      transactionId: transaction._id,
      status: transaction.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment processing failed." });
  }
});

module.exports = router;

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

// In-memory OTP store for demo: Map<userId, { otp, expiresAt, receiverId, amount, bankId }>
const otpStore = new Map();

// Helper to generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/payment/bank/initiate
// Body: { bankUsername, bankPassword, receiverId, amount }
// Verifies bank credentials (for the logged-in user), generates OTP and stores it in memory
router.post('/bank/initiate', authMiddleware, async (req, res) => {
  try {
    const { bankUsername, bankPassword, receiverId, amount } = req.body;
    if (!bankUsername || !bankPassword || !receiverId || !amount) {
      return res.status(400).json({ message: 'bankUsername, bankPassword, receiverId and amount are required' });
    }

    // Find bank account for this user
    const BankAccount = require('../models/BankAccount');
    const bank = await BankAccount.findOne({ userId: req.user.id, bankUsername });
    if (!bank) return res.status(400).json({ message: 'Bank account not found for this user' });

    const isPassOk = await bank.comparePassword(bankPassword);
    if (!isPassOk) return res.status(400).json({ message: 'Invalid bank username/password' });

    // Generate OTP and store
    const otp = generateOtp();
    const expiresAt = Date.now() + (2 * 60 * 1000); // 2 minutes

    otpStore.set(req.user.id.toString(), {
      otp,
      expiresAt,
      receiverId,
      amount,
      bankId: bank._id.toString()
    });

    // For demo: return OTP in response (in production you would SMS it)
    console.log(`Generated OTP for user ${req.user.id}: ${otp}`); // server console
    // If you integrate Twilio/Fast2SMS later, call it here using bank.phone

    return res.json({ message: 'OTP generated and sent (demo).', otpSent: true, otp }); // returning otp for demo/testing
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to initiate bank payment' });
  }
});

// POST /api/payment/bank/verify-otp
// Body: { otp }
// POST /api/payment/bank/verify-otp
router.post('/bank/verify-otp', authMiddleware, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    const record = otpStore.get(req.user.id.toString());
    if (!record) return res.status(400).json({ message: 'No pending OTP for this user. Initiate payment first.' });

    if (Date.now() > record.expiresAt) {
      otpStore.delete(req.user.id.toString());
      return res.status(400).json({ message: 'OTP expired. Please initiate again.' });
    }

    if (record.otp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    // ✅ OTP valid — proceed to bank transaction
    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(record.receiverId);
    if (!receiver) {
      otpStore.delete(req.user.id.toString());
      return res.status(400).json({ message: 'Invalid receiver' });
    }

    const amount = Number(record.amount);

    const BankAccount = require('../models/BankAccount');
    const bank = await BankAccount.findById(record.bankId);

    if (!bank) {
      otpStore.delete(req.user.id.toString());
      return res.status(400).json({ message: 'Bank account not found for transaction' });
    }

    // ✅ Check bank balance (not wallet)
    if (bank.balance < amount) {
      otpStore.delete(req.user.id.toString());
      return res.status(400).json({ message: 'Insufficient bank account balance', status: 'Failed' });
    }

    // ✅ Deduct from bank balance, credit receiver wallet
    bank.balance -= amount;
    receiver.balance += amount;

    await bank.save();
    await receiver.save();

    // ✅ Create transaction record
    const encryptedPin = 'N/A';
    const data = `${req.user.id}:${record.receiverId}:${amount}:Bank:${encryptedPin}`;
    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'defaultsecret')
      .update(data)
      .digest('hex');

    const transaction = new Transaction({
      userId: req.user.id,
      receiverId: record.receiverId,
      amount,
      type: 'Bank',
      pin: encryptedPin,
      hmac,
      status: 'Success',
    });

    await transaction.save();

    otpStore.delete(req.user.id.toString());

    return res.status(201).json({
      message: '✅ Bank payment successful',
      transactionId: transaction._id,
      status: 'Success',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to verify OTP and complete payment' });
  }
});


module.exports = router;