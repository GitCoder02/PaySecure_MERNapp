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

  // UPI: require 4-digit PIN when type === "UPI"
  body("pin")
    .if((value, { req }) => req.body.type === "UPI")
    .notEmpty().withMessage("PIN is required for UPI")
    .isLength({ min: 4, max: 4 }).withMessage("PIN must be 4 digits")
    .matches(/^\d{4}$/).withMessage("PIN must be numeric"),

  // Card: validate only when type === "Card"
  body("cardNumber")
    .if((value, { req }) => req.body.type === "Card")
    .notEmpty().withMessage("Card number is required")
    .trim()
    .isLength({ min: 16, max: 16 })
    .withMessage("Card number must be 16 digits")
    .isNumeric().withMessage("Card number must contain only digits"),
  body("cvv")
    .if((value, { req }) => req.body.type === "Card")
    .notEmpty().withMessage("CVV is required")
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage("CVV must be 3 digits")
    .isNumeric().withMessage("CVV must contain only digits"),
  body("expiryMonth")
    .if((value, { req }) => req.body.type === "Card")
    .notEmpty().withMessage("Expiry month is required")
    .isInt({ min: 1, max: 12 })
    .withMessage("Invalid expiry month"),
  body("expiryYear")
    .if((value, { req }) => req.body.type === "Card")
    .notEmpty().withMessage("Expiry year is required")
    .isInt({ min: new Date().getFullYear() })
    .withMessage("Invalid expiry year"),

  // Bank: require bank credentials only when type === "Bank"
  body("bankUsername")
    .if((value, { req }) => req.body.type === "Bank")
    .notEmpty().withMessage("Bank username is required"),
  body("bankPassword")
    .if((value, { req }) => req.body.type === "Bank")
    .notEmpty().withMessage("Bank password is required"),
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