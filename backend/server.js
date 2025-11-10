const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const { initializeKeys } = require('./utils/signatures');



dotenv.config(); // Load .env
// Initialize RSA key pair on server startup
initializeKeys();


const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(express.json());

// --- Rate limiters ---
const {
  loginLimiter,
  paymentLimiter,
  otpLimiter,
} = require("./middleware/rateLimiter");

//  Apply critical rate limiters globally BEFORE routes are mounted
app.use("/api/auth/login", loginLimiter);           // Brute-force protection on login
app.use("/api/payment/pay", paymentLimiter);        // Protect payment endpoint
app.use("/api/payment/bank/initiate", otpLimiter);  // Protect OTP generator


// authRoutes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// authentication middleware and protected route 
const authMiddleware = require('./middleware/auth');
app.get('/api/dashboard', authMiddleware, (req, res) => {
    res.json({ message: `Welcome ${req.user.email}`, user: req.user });
});

// paymentRoutes
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

const bankRoutes = require('./routes/bank');
app.use('/api/bank', bankRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('Backend is running');
});


// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));