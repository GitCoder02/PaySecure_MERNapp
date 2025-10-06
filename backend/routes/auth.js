const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const authMiddleware = require("../middleware/auth");
const { validateRegister, validateLogin } = require("../middleware/validators");

// 🧾 REGISTER NEW USER
router.post("/register", validateRegister, async (req, res) => {
  // 1️⃣ Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, upiId, pin } = req.body;

  try {
    // 2️⃣ Check duplicates
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    if (upiId) {
      const existingUpi = await User.findOne({ upiId });
      if (existingUpi)
        return res.status(400).json({ message: "UPI ID already registered" });
    }

    // 3️⃣ Create and save new user
    const user = new User({ name, email, password, upiId, pin });
    await user.save();

    // 4️⃣ Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// 🔐 LOGIN USER
router.post("/login", validateLogin, async (req, res) => {
  // 1️⃣ Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // 2️⃣ Find and verify user
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // 3️⃣ Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// 🔒 SET OR UPDATE UPI PIN
router.post("/set-pin", authMiddleware, async (req, res) => {
  const { pin } = req.body;

  // Validate PIN format
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ message: "PIN must be 4 digits" });
  }

  try {
    const user = await User.findById(req.user.id);
    user.pin = pin; // auto-hashed by schema
    await user.save();

    res.json({ message: "PIN set successfully" });
  } catch (err) {
    console.error("Set PIN Error:", err);
    res.status(500).json({ message: "Error setting PIN" });
  }
});

// 👤 GET LOGGED-IN USER PROFILE
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -pin");
    res.json(user);
  } catch (err) {
    console.error("Fetch User Error:", err);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// 🧑‍💼 GET ALL MERCHANTS (for customers’ payment dropdown)
router.get("/merchants", async (req, res) => {
  try {
    const merchants = await User.find({ role: "merchant" }).select(
      "name email _id"
    );
    res.json({ merchants });
  } catch (err) {
    console.error("Fetch Merchants Error:", err);
    res.status(500).json({ message: "Failed to fetch merchants" });
  }
});

module.exports = router;