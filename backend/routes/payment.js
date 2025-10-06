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

// ✅ AES Encryption (for PIN)
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

// ✅ Luhn algorithm for card validation
function isValidCardNumber(cardNumber) {
  let sum = 0, shouldDouble = false;
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// 💳 /api/payment/pay
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
  } = req.body;

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
      if (!isPinValid) return res.status(400).json({ message: "Invalid UPI PIN" });

      if (sender.balance < amount)
        return res.status(400).json({ message: "Insufficient wallet balance" });

      const { encrypted } = encrypt(pin);
      encryptedPin = encrypted;
      sender.balance -= amount;
      receiver.balance += amount;
      transactionStatus = "Success";
    }

    // ---------------- CARD FLOW ----------------
    else if (type === "Card") {
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv)
        return res.status(400).json({ message: "All card fields are required" });

      if (!/^\d{16}$/.test(cardNumber) || !isValidCardNumber(cardNumber))
        return res.status(400).json({ message: "Invalid card number" });

      if (!(expiryMonth >= 1 && expiryMonth <= 12))
        return res.status(400).json({ message: "Invalid expiry month" });

      if (expiryYear < new Date().getFullYear())
        return res.status(400).json({ message: "Invalid expiry year" });

      if (!/^\d{3}$/.test(cvv))
        return res.status(400).json({ message: "CVV must be 3 digits" });

      if (sender.balance < amount)
        return res.status(400).json({ message: "Insufficient wallet balance" });

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

    // ---------------- INVALID TYPE ----------------
    else {
      return res.status(400).json({ message: "Invalid payment type" });
    }

    // ✅ HMAC integrity check
    const data = `${req.user.id}:${receiverId}:${amount}:${type}:${encryptedPin}`;
    const hmac = crypto
      .createHmac("sha256", process.env.HMAC_SECRET || "defaultsecret")
      .update(data)
      .digest("hex");

    // ✅ Create transaction
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
    console.error("Payment Error:", err);
    res.status(500).json({ message: "Payment processing failed" });
  }
});


// 💸 BANK OTP FLOW — STEP 1: INITIATE OTP
const otpStore = new Map(); // In-memory
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/bank/initiate", authMiddleware, validateBankInitiate, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { bankUsername, bankPassword, receiverId, amount } = req.body;

    const bank = await BankAccount.findOne({ userId: req.user.id, bankUsername });
    if (!bank) return res.status(400).json({ message: "Bank account not found" });

    const isPassOk = await bank.comparePassword(bankPassword);
    if (!isPassOk) return res.status(400).json({ message: "Invalid bank credentials" });

    const otp = generateOtp();
    const expiresAt = Date.now() + 2 * 60 * 1000; // 2 min expiry

    otpStore.set(req.user.id.toString(), {
      otp,
      expiresAt,
      receiverId,
      amount,
      bankId: bank._id.toString(),
    });

    console.log(`OTP for ${req.user.id}: ${otp}`);
    res.json({ message: "OTP sent (demo)", otp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to initiate bank OTP" });
  }
});


// 💸 BANK OTP FLOW — STEP 2: VERIFY & COMPLETE PAYMENT
router.post("/bank/verify-otp", authMiddleware, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: "OTP is required" });

    const record = otpStore.get(req.user.id.toString());
    if (!record)
      return res.status(400).json({ message: "No pending OTP found. Please initiate first." });

    if (Date.now() > record.expiresAt) {
      otpStore.delete(req.user.id.toString());
      return res.status(400).json({ message: "OTP expired. Please try again." });
    }

    if (record.otp !== otp.toString())
      return res.status(400).json({ message: "Invalid OTP" });

    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(record.receiverId);
    const bank = await BankAccount.findById(record.bankId);

    if (!receiver || !bank)
      return res.status(400).json({ message: "Transaction participants not found" });

    const amount = Number(record.amount);
    if (bank.balance < amount)
      return res.status(400).json({ message: "Insufficient bank balance" });

    // ✅ Transfer
    bank.balance -= amount;
    receiver.balance += amount;
    await bank.save();
    await receiver.save();

    // ✅ Record transaction
    const encryptedPin = "N/A";
    const data = `${req.user.id}:${record.receiverId}:${amount}:Bank:${encryptedPin}`;
    const hmac = crypto
      .createHmac("sha256", process.env.HMAC_SECRET || "defaultsecret")
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
    otpStore.delete(req.user.id.toString());

    res.status(201).json({
      message: "Bank payment successful ✅",
      transactionId: transaction._id,
      status: "Success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify OTP and complete payment" });
  }
});

// ✅ Get Received Transactions (Merchant)
router.get("/received", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ receiverId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("userId", "name");
    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch received transactions" });
  }
});

// ✅ Get Transaction History (User)
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("receiverId", "name");
    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch transaction history" });
  }
});

// ✅ Get All Transactions (Admin)
router.get("/all", adminMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name")
      .populate("receiverId", "name");
    res.json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch all transactions" });
  }
});

module.exports = router;