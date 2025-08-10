// src/schemas/coupon.schema.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true }, // percentage => 10 means 10%
  discountValue: { type: Number, required: true }, // if percentage -> between 0-100, if fixed -> currency amount
  expiryDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  usageLimit: { type: Number, default: null }, // optional limit of uses across users
  usedCount: { type: Number, default: 0 }, // track usage
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
