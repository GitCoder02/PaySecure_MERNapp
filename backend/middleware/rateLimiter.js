// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Helpers to create rate limiter with consistent response shape.
 */
function createLimiter(opts) {
  console.log(`Creating rate limiter: max=${opts.max} windowMs=${opts.windowMs} for message="${opts.message}"`);
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the deprecated `X-RateLimit-*` headers
    // keep your previous message function/shape
    message: (req, res) => {
      return {
        message: opts.message || 'Too many requests, please try again later.',
        retryAfterSeconds: Math.ceil(opts.windowMs / 1000),
      };
    },
    keyGenerator: ipKeyGenerator,
    // explicit handler so we log and return JSON consistently
    handler: (req, res, next, options) => {
      console.warn(`Rate limit exceeded for key=${req.ip} url=${req.originalUrl}`);
      const body = typeof options.message === 'function' ? options.message(req, res) : options.message;
      res.status(options.statusCode || 429).json(body);
    },
  });
}

// Limits (tweak numbers as you like)
const loginLimiter = createLimiter({
  windowMs: 10 * 1000, // 1 minute
  max: 2, // 10 login attempts per minute per IP
  message: 'Too many login attempts. Please wait a while and try again.',
});

const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: 'Too many registration attempts. Try again later.',
});

const twoFaLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 6, // 6 TOTP attempts per minute (adjust for UX)
  message: 'Too many two-factor attempts. Please wait a moment.',
});

const paymentLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 payment requests per minute per IP
  message: 'Too many payment attempts. Slow down.',
});

const otpLimiter = createLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 OTP initiations per 10 minutes per IP
  message: 'Too many OTP requests. Try again later.',
});

const bankAddLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 bank-add actions per hour per IP
  message: 'Too many bank account additions. Try again later.',
});

module.exports = {
  loginLimiter,
  registerLimiter,
  twoFaLimiter,
  paymentLimiter,
  otpLimiter,
  bankAddLimiter,
};
