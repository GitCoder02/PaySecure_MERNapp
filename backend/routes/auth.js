const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

// Register new user (with optional PIN)
router.post('/register', async (req, res) => {
    const { name, email, password, pin } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create new user (password & pin will be hashed in schema)
        const user = new User({ name, email, password, pin });
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({ message: 'User registered successfully', token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Set or Update PIN
router.post('/set-pin', authMiddleware, async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin || pin.length !== 4) {
            return res.status(400).json({ message: 'PIN must be 4 digits' });
        }

        const user = await User.findById(req.user.id);
        user.pin = pin; // auto-hashed by schema
        await user.save();

        res.json({ message: 'PIN set successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error setting PIN' });
    }
});

// Get logged-in user details
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -pin");
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching user" });
    }
});

// routes/auth.js
router.get('/merchants', async (req, res) => {
  try {
    const merchants = await User.find({ role: 'merchant' }).select('name email _id');
    res.json({ merchants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch merchants' });
  }
});


module.exports = router;
