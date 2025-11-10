const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const authMiddleware = require("../middleware/auth");
const { validateRegister, validateLogin } = require("../middleware/validators");
const { authenticator } = require("otplib");
const qrcode = require("qrcode");
const Audit = require("../models/Audit");
const { loginLimiter, registerLimiter, twoFaLimiter } = require('../middleware/rateLimiter');


/* -----------------------------------------------
  REGISTER NEW USER
-------------------------------------------------*/
router.post("/register", registerLimiter, validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { name, email, password, upiId, pin } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    if (upiId) {
      const existingUpi = await User.findOne({ upiId });
      if (existingUpi)
        return res.status(400).json({ message: "UPI ID already registered" });
    }

    const user = new User({ name, email, password, upiId, pin });
    await user.save();

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

/* -----------------------------------------------
 LOGIN (EMAIL + PASSWORD)
-------------------------------------------------*/
router.post("/login", loginLimiter, validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // ✅ If user has 2FA enabled → don't log in yet
    if (user.twoFactorEnabled) {
      return res.status(200).json({
        require2fa: true,
        userId: user._id,
        message: "2FA required. Please verify your 6-digit code.",
      });
    }

    //  If 2FA disabled → login as usual
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ message: "Login successful", token });
    await Audit.create({
      userId: user._id,
      action: "USER_LOGIN_SUCCESS",
      meta: { email: user.email },
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

/* -----------------------------------------------
 STEP 2: VERIFY 2FA CODE (AFTER PASSWORD LOGIN)
-------------------------------------------------*/
router.post("/2fa/login-verify", twoFaLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code)
      return res.status(400).json({ message: "Missing userId or code" });

    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret)
      return res
        .status(400)
        .json({ message: "No 2FA setup found for this user" });

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) return res.status(400).json({ message: "Invalid 2FA code" });

    //  Generate token now that both steps passed
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ message: "2FA verified successfully", token });
  } catch (err) {
    console.error("2FA Login Verify Error:", err);
    res.status(500).json({ message: "2FA verification failed" });
  }
});

/* -----------------------------------------------
  SET OR UPDATE UPI PIN
-------------------------------------------------*/
router.post("/set-pin", authMiddleware, async (req, res) => {
  const { pin } = req.body;
  if (!/^\d{4}$/.test(pin))
    return res.status(400).json({ message: "PIN must be 4 digits" });

  try {
    const user = await User.findById(req.user.id);
    user.pin = pin;
    await user.save();

    res.json({ message: "PIN set successfully" });
  } catch (err) {
    console.error("Set PIN Error:", err);
    res.status(500).json({ message: "Error setting PIN" });
  }
});

/* -----------------------------------------------
  GET LOGGED-IN USER PROFILE
-------------------------------------------------*/
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -pin");
    res.json(user);
  } catch (err) {
    console.error("Fetch User Error:", err);
    res.status(500).json({ message: "Error fetching user" });
  }
});

/* -----------------------------------------------
  GET ALL MERCHANTS
-------------------------------------------------*/
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

/* -----------------------------------------------
  2FA SETUP (Generate Secret + QR)
-------------------------------------------------*/
router.post("/2fa/setup", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, "PaySecure", secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    user.twoFactorSecret = secret;
    await user.save();

    res.json({
      message: "Scan this QR code with Google Authenticator",
      qrCode: qrCodeDataUrl,
      secret, // only for demo
    });
  } catch (err) {
    console.error("2FA Setup Error:", err);
    res.status(500).json({ message: "Failed to generate 2FA setup" });
  }
});

/* -----------------------------------------------
  2FA VERIFY (Enable 2FA for Account)
-------------------------------------------------*/
router.post("/2fa/verify", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });

    const user = await User.findById(req.user.id);
    if (!user || !user.twoFactorSecret)
      return res.status(400).json({ message: "No 2FA setup found" });

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) return res.status(400).json({ message: "Invalid 2FA code" });

    user.twoFactorEnabled = true;
    await user.save();

    res.json({ message: "✅ 2FA enabled successfully" });
  } catch (err) {
    console.error("2FA Verify Error:", err);
    res.status(500).json({ message: "2FA verification failed" });
  }
});

//  STEP 2: VERIFY 2FA CODE AND COMPLETE LOGIN
router.post("/2fa/verify-login", async (req, res) => {
  try {
    const { email, twoFactorCode } = req.body;

    if (!email || !twoFactorCode)
      return res
        .status(400)
        .json({ message: "Email and 2FA code are required." });

    // 1️ Find the user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found." });

    if (!user.twoFactorEnabled || !user.twoFactorSecret)
      return res
        .status(400)
        .json({ message: "2FA is not enabled for this account." });

    // 2️ Verify the 6-digit TOTP code
    const isValid = authenticator.verify({
      token: twoFactorCode,
      secret: user.twoFactorSecret,
    });

    if (!isValid)
      return res.status(400).json({ message: "Invalid 2FA code." });

    // 3️ Generate JWT after successful 2FA
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "2FA verification successful.",
      token,
    });
  } catch (err) {
    console.error("2FA Login Verify Error:", err);
    res.status(500).json({ message: "Server error verifying 2FA login." });
  }
});


module.exports = router;