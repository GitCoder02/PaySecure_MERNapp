// backend/middleware/validators.js
const { body } = require("express-validator");

// 🧾 Register Validation
exports.validateRegister = [
  body("name")
    .trim()
    .escape()
    .notEmpty()
    .withMessage("Name is required"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("upiId")
    .optional()
    .trim()
    .matches(/^[\w.-]+@[\w.-]+$/)
    .withMessage("Invalid UPI ID format (e.g., user@bank)"),
  body("pin")
    .optional()
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage("PIN must be exactly 4 digits"),
];

// 🔐 Login Validation
exports.validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email"),
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

// 💳 Payment Validation (UPI / Card / Bank)
exports.validatePayment = [
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("Amount must be greater than 0")
    .toFloat(),
  body("type")
    .isIn(["UPI", "Card", "Bank"])
    .withMessage("Invalid payment type"),
  body("receiverId")
    .isMongoId()
    .withMessage("Invalid receiver ID format"),
  body("pin")
    .optional()
    .trim()
    .escape(),
  body("cardNumber")
    .optional()
    .trim()
    .isLength({ min: 16, max: 16 })
    .withMessage("Card number must be 16 digits")
    .escape(),
  body("cvv")
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage("CVV must be 3 digits")
    .escape(),
  body("expiryMonth")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Invalid expiry month"),
  body("expiryYear")
    .optional()
    .isInt({ min: new Date().getFullYear() })
    .withMessage("Invalid expiry year"),
];

// 🏦 Bank Transfer (Initiate OTP)
exports.validateBankInitiate = [
  body("bankUsername")
    .trim()
    .escape()
    .notEmpty()
    .withMessage("Bank username is required"),
  body("bankPassword")
    .trim()
    .notEmpty()
    .withMessage("Bank password is required"),
  body("receiverId")
    .isMongoId()
    .withMessage("Invalid receiver ID"),
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("Amount must be positive")
    .toFloat(),
];