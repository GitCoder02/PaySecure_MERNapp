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
    pin: {
        type: String, // Will be hashed like password
    },
    balance: {
        type: Number,
        default: 5000 // starting wallet balance for demo
    },
    role: {
    type: String,
    enum: ['user', 'merchant', 'admin'],  // 👈 added merchant role
    default: 'user'
    }
}, { timestamps: true });

/**
 * Hash password before saving
 */
userSchema.pre('save', async function(next) {
    try {
        // Hash password if modified
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }

        // Hash PIN if modified
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
 * Compare plain password with hashed password
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Compare plain PIN with hashed PIN
 */
userSchema.methods.comparePin = async function(candidatePin) {
    if (!this.pin) return false; // no PIN set yet
    return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model('User', userSchema);