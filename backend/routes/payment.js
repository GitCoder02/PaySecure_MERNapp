// backend/routes/payment.js
const express = require("express");
const router = express.Router();
const { validationResult } = require("express-validator");
const { validatePayment, validateBankInitiate } = require("../middleware/validators");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/adminMiddleware");
const Transaction = require("../models/Transaction");
const BankAccount = require("../models/BankAccount");
const User = require("../models/User");
const crypto = require("crypto");
const { authenticator } = require("otplib");
const mongoose = require("mongoose");

//  AES Encryption (for PIN)
function encrypt(pin) {
  const algorithm = "aes-256-gcm";
  const secret = process.env.AES_SECRET_KEY;
  if (!secret) throw new Error("Missing AES_SECRET_KEY in .env");

  const key = crypto.createHash("sha256").update(secret, "utf8").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(pin, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), authTag };
}

// Luhn algorithm for Card validation
function isValidCardNumber(cardNumber) {
  let sum = 0,
    shouldDouble = false;
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// ----------------- OTP model (temporary store in Mongo) -----------------
const otpSchema = new mongoose.Schema({
  userId: String,
  otp: String,
  expiresAt: Date,
  receiverId: String,
  amount: Number,
  bankId: String,
});
const OtpRecord = mongoose.models.OtpRecord || mongoose.model("OtpRecord", otpSchema);


router.post("/bank/initiate", authMiddleware, validateBankInitiate, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { bankUsername, bankPassword, receiverId, amount } = req.body;
    const sender = await User.findById(req.user.id);
    if (!sender) return res.status(400).json({ message: "Sender not found" });

    const bank = await BankAccount.findOne({ userId: sender._id, bankUsername });
    if (!bank) return res.status(400).json({ message: "Bank account not found" });

    const isPassOk = await bank.comparePassword(bankPassword);
    if (!isPassOk) return res.status(400).json({ message: "Invalid bank credentials" });

    // create OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await OtpRecord.findOneAndUpdate(
      { userId: sender._id.toString() },
      { otp, expiresAt, receiverId, amount, bankId: bank._id.toString() },
      { upsert: true, new: true }
    );

    console.log(`📩 OTP for ${sender.email} (userId=${sender._id}): ${otp}`);

    return res.status(200).json({
      message: "OTP sent (demo only, check server logs). Please verify to complete payment.",
      otp, 
    });
  } catch (err) {
    console.error("Bank Initiate Error:", err);
    res.status(500).json({ message: "Failed to initiate bank OTP" });
  }
});

/* ===========================================================
 VERIFY BANK OTP — With optional 2FA for high-value bank payments
=========================================================== */
router.post("/bank/verify-otp", authMiddleware, async (req, res) => {
  try {
    const { otp, twoFactorCode } = req.body;
    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const record = await OtpRecord.findOne({ userId: req.user.id.toString() });
    if (!record) return res.status(400).json({ message: "No pending OTP found. Please initiate first." });

    // expiresAt is a Date object — compare correctly
    if (Date.now() > record.expiresAt.getTime()) {
      await OtpRecord.deleteOne({ userId: req.user.id.toString() });
      return res.status(400).json({ message: "OTP expired. Please initiate again." });
    }

    if (record.otp !== otp.toString())
      return res.status(400).json({ message: "Invalid OTP" });

    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(record.receiverId);
    const bank = await BankAccount.findById(record.bankId);

    if (!sender || !receiver || !bank)
      return res.status(400).json({ message: "Transaction participants not found" });

    // 2FA check for high-value bank payments (>5000)
    if (Number(record.amount) > 5000 && sender.twoFactorEnabled) {
      if (!twoFactorCode) return res.status(400).json({ message: "2FA code required for high-value bank payment" });

      const isValid2FA = authenticator.verify({
        token: twoFactorCode,
        secret: sender.twoFactorSecret,
      });

      if (!isValid2FA) return res.status(400).json({ message: "Invalid 2FA code. Please check your Authenticator app." });
    }

    const amount = Number(record.amount);
    if (bank.balance < amount) return res.status(400).json({ message: "Insufficient bank balance" });

    // Transfer
    bank.balance -= amount;
    receiver.balance += amount;
    await bank.save();
    await receiver.save();

    // Record transaction
    const encryptedPin = "N/A";
    const data = `${req.user.id}:${record.receiverId}:${amount}:Bank:${encryptedPin}`;
    const hmac = crypto.createHmac("sha256", process.env.HMAC_SECRET || "defaultsecret")
      .update(data)
      .digest("hex");

    const transaction = new Transaction({
      userId: req.user.id,
      receiverId: record.receiverId,
      amount,
      type: "Bank",
      pin: encryptedPin,
      hmac,
      status: "Success",
    });

    await transaction.save();
    await OtpRecord.deleteOne({ userId: req.user.id.toString() });

    return res.status(201).json({
      message: "✅ Bank payment successful with verified 2FA & OTP",
      transactionId: transaction._id,
      status: "Success",
    });
  } catch (err) {
    console.error("Bank OTP Verify Error:", err);
    res.status(500).json({ message: "Failed to verify OTP and complete bank payment." });
  }
});

/* ===========================================================
  /pay route 
=========================================================== */
router.post("/pay", authMiddleware, validatePayment, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
    twoFactorCode,
    bankUsername,
    bankPassword
  } = req.body;

  try {
    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(400).json({ message: "Invalid merchant" });

    // 2FA for high-value payments (applies to UPI/Card here)
    if (Number(amount) > 5000 && sender.twoFactorEnabled) {
      if (!twoFactorCode) return res.status(400).json({ message: "2FA code required for high-value payments" });
      const isValid2FA = authenticator.verify({ token: twoFactorCode, secret: sender.twoFactorSecret });
      if (!isValid2FA) return res.status(400).json({ message: "Invalid 2FA code" });
    }

    let encryptedPin = "";
    let transactionStatus = "Pending";

    // UPI
    if (type === "UPI") {
      if (!pin) return res.status(400).json({ message: "PIN required for UPI" });
      const isPinValid = await sender.comparePin(pin);
      if (!isPinValid) return res.status(400).json({ message: "Invalid UPI PIN" });
      if (sender.balance < amount) return res.status(400).json({ message: "Insufficient wallet balance" });

      const { encrypted } = encrypt(pin);
      encryptedPin = encrypted;
      sender.balance -= amount;
      receiver.balance += amount;
      transactionStatus = "Success";
    }

    // Card
    else if (type === "Card") {
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv) return res.status(400).json({ message: "All card fields are required" });
      if (!/^\d{16}$/.test(cardNumber) || !isValidCardNumber(cardNumber)) return res.status(400).json({ message: "Invalid card number" });
      if (!(expiryMonth >= 1 && expiryMonth <= 12)) return res.status(400).json({ message: "Invalid expiry month" });
      if (expiryYear < new Date().getFullYear()) return res.status(400).json({ message: "Invalid expiry year" });
      if (!/^\d{3}$/.test(cvv)) return res.status(400).json({ message: "CVV must be 3 digits" });
      if (sender.balance < amount) return res.status(400).json({ message: "Insufficient wallet balance" });

      sender.balance -= amount;
      receiver.balance += amount;
      transactionStatus = "Success";
      encryptedPin = "N/A";

      if (saveCard) {
        sender.cardLast4 = cardNumber.slice(-4);
        sender.cardExpiryMonth = expiryMonth;
        sender.cardExpiryYear = expiryYear;
        await sender.save();
      }
    }

    // Bank branch (as fallback) 
    else if (type === "Bank") {
      // If frontend uses /pay for bank, we can support quick bank-pay 
      const bank = await BankAccount.findOne({ userId: sender._id, bankUsername });
      if (!bank) return res.status(400).json({ message: "Bank account not found" });
      const isPassOk = await bank.comparePassword(bankPassword);
      if (!isPassOk) return res.status(400).json({ message: "Invalid bank credentials" });

      if (Number(amount) > bank.balance) return res.status(400).json({ message: "Insufficient bank balance" });

      // For simplicity, directly transfer
      bank.balance -= amount;
      receiver.balance += amount;
      await bank.save();
      transactionStatus = "Success";
      encryptedPin = "N/A";
      await sender.save();
    } else {
      return res.status(400).json({ message: "Invalid payment type" });
    }

    // HMAC
    const data = `${req.user.id}:${receiverId}:${amount}:${type}:${encryptedPin}`;
    const hmac = crypto.createHmac("sha256", process.env.HMAC_SECRET || "defaultsecret")
      .update(data)
      .digest("hex");

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

    return res.status(201).json({
      message: "Payment successful",
      transactionId: transaction._id,
      status: transaction.status,
    });
  } catch (err) {
    console.error("Payment Error:", err);
    return res.status(500).json({ message: "Payment processing failed" });
  }
});

/* ===========================================================
  Transaction history & admin endpoints 
=========================================================== */

// Get Received Transactions (Merchant)
router.get("/received", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ receiverId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("userId", "name");
    res.json({ transactions });
  } catch (err) {
    console.error("Fetch Received Error:", err);
    res.status(500).json({ message: "Failed to fetch received transactions" });
  }
});

// Get Transaction History (User)
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("receiverId", "name");
    res.json({ transactions });
  } catch (err) {
    console.error("Fetch History Error:", err);
    res.status(500).json({ message: "Failed to fetch transaction history" });
  }
});

// Get All Transactions (Admin)
router.get("/all", adminMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name")
      .populate("receiverId", "name");
    res.json({ transactions });
  } catch (err) {
    console.error("Fetch All Tx Error:", err);
    res.status(500).json({ message: "Failed to fetch all transactions" });
  }
});

module.exports = router;