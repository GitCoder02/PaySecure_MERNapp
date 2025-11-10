// backend/utils/risk.js
// Rule-based risk scoring engine for PaySecure
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const mongoose = require("mongoose");

/**
 * Compute a risk score (0-100) and reasons for a candidate transaction.
 * Accepts an object with fields: { userId, receiverId, amount, type, createdAt }
 * Returns: { score: Number, reasons: String[] }
 */
async function computeRiskForTransaction({ userId, receiverId, amount, type, createdAt }) {
  const reasons = [];
  let score = 0;

  // Safety: ensure ObjectId
  const uid = new mongoose.Types.ObjectId(userId);
  const rid = new mongoose.Types.ObjectId(receiverId);

  // 1) Large amount test: dynamic threshold based on user's recent average
  try {
    // compute average transaction amount for this user over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const agg = await Transaction.aggregate([
      { $match: { userId: uid, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$userId", avgAmount: { $avg: "$amount" }, maxAmount: { $max: "$amount" } } },
    ]);

    const avgAmount = agg?.[0]?.avgAmount || 0;
    // thresholds
    const staticLarge = 5000;
    const dynamicMultiplier = 5; // if amount > dynamicMultiplier * avgAmount => suspicious

    if (amount > staticLarge) {
      score += 40;
      reasons.push(`Amount ₹${amount} exceeds static threshold ₹${staticLarge}`);
    } else if (avgAmount > 0 && amount > Math.max(staticLarge * 0.6, avgAmount * dynamicMultiplier)) {
      // if user's avg exists and current >> avg
      score += 35;
      reasons.push(`Amount ₹${amount} is ${Math.round(amount / (avgAmount || 1))}x user's avg (₹${Math.round(avgAmount)})`);
    }
  } catch (e) {
    console.warn("Risk: large amount check failed", e);
  }

  // 2) Frequency: more than 5 transactions in last 10 minutes
  try {
    const tenMinAgo = new Date((createdAt || Date.now()) - 10 * 60 * 1000);
    const recentCount = await Transaction.countDocuments({
      userId: uid,
      createdAt: { $gte: tenMinAgo },
    });
    if (recentCount >= 5) {
      score += 30;
      reasons.push(`User made ${recentCount} transactions in last 10 minutes`);
    }
  } catch (e) {
    console.warn("Risk: frequency check failed", e);
  }

  // 3) New user: account created < 24 hours
  try {
    const user = await User.findById(uid).select("createdAt");
    if (user) {
      const createdAgoMs = Date.now() - new Date(user.createdAt).getTime();
      if (createdAgoMs < 24 * 60 * 60 * 1000) {
        score += 20;
        reasons.push("Account is new (created < 24 hours)");
      }
    }
  } catch (e) {
    console.warn("Risk: new user check failed", e);
  }

  // 4) Balance drain attempt: if user's balance after tx <= 0 or close to zero
  try {
    const user = await User.findById(uid).select("balance");
    if (user) {
      const remaining = (user.balance || 0) - amount;
      if (remaining <= 0) {
        score += 15;
        reasons.push("Transaction would drain or overdraw user's balance");
      } else if (remaining < (user.balance || 0) * 0.1) {
        score += 8;
        reasons.push("Transaction leaves very low remaining balance");
      }
    }
  } catch (e) {
    console.warn("Risk: balance check failed", e);
  }

  // 5) Cross-user pattern: same receiver got payments from > 3 unique senders in last 10 minutes
  try {
    const tenMinAgo = new Date((createdAt || Date.now()) - 10 * 60 * 1000);
    const recent = await Transaction.aggregate([
      { $match: { receiverId: rid, createdAt: { $gte: tenMinAgo } } },
      { $group: { _id: "$userId" } },
      { $count: "uniqueSenders" },
    ]);
    const uniqueSenders = recent?.[0]?.uniqueSenders || 0;
    if (uniqueSenders >= 3) {
      score += 20;
      reasons.push(`Receiver received funds from ${uniqueSenders} unique users in last 10 minutes`);
    }
  } catch (e) {
    console.warn("Risk: cross-user check failed", e);
  }

  // Normalize score to max 100
  if (score > 100) score = 100;

  // Round and return
  return {
    score: Math.round(score),
    reasons,
  };
}

module.exports = {
  computeRiskForTransaction,
};
