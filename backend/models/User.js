const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define user schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    upiId: { 
        type: String,
        unique: true,
        sparse: true,   // allows users without UPI ID (merchants/admins)
        trim: true
    },
    pin: {
        type: String, // Will be hashed like password
    },
    balance: {
        type: Number,
        default: 5000 // starting wallet balance for demo
    },
    role: {
        type: String,
        enum: ['user', 'merchant', 'admin'],
        default: 'user'
    },
    // ✅ Card fields for saved cards
    cardLast4: { type: String, maxlength: 4 },
    cardExpiryMonth: { type: Number, min: 1, max: 12 },
    cardExpiryYear: { type: Number }
}, { timestamps: true });

/**
 * Hash password and PIN before saving
 */
userSchema.pre('save', async function(next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }

        if (this.isModified('pin') && this.pin) {
            const salt = await bcrypt.genSalt(10);
            this.pin = await bcrypt.hash(this.pin, salt);
        }

        next();
    } catch (err) {
        next(err);
    }
});

/**
 * Compare functions
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.comparePin = async function(candidatePin) {
    if (!this.pin) return false;
    return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model('User', userSchema);