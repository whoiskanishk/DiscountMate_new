// src/controllers/coupon.controller.js
const { connectToMongoDB } = require('../config/database');
const jwt = require('jsonwebtoken');

/**
 * Create a coupon (admin only)
 * body: { code, discountType, discountValue, expiryDate, active (optional), usageLimit (optional) }
 */
const createCoupon = async (req, res) => {
  try {
    // Check admin from token
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (!decoded.admin) return res.status(403).json({ message: 'Admin only' });

    const { code, discountType, discountValue, expiryDate, active = true, usageLimit = null } = req.body;
    if (!code || !discountType || discountValue == null || !expiryDate) {
      return res.status(400).json({ message: 'Missing required coupon fields' });
    }

    const db = await connectToMongoDB();
    const coupons = db.collection('coupons');

    const normalizedCode = code.trim().toUpperCase();

    // Check duplicate
    const existing = await coupons.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = {
      code: normalizedCode,
      discountType,
      discountValue: Number(discountValue),
      expiryDate: new Date(expiryDate),
      active: !!active,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      usedCount: 0,
      createdAt: new Date()
    };

    const result = await coupons.insertOne(coupon);
    return res.status(201).json({ message: 'Coupon created', couponId: result.insertedId });
  } catch (error) {
    console.error('createCoupon error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * List coupons (optionally only active ones)
 * query: ?active=true
 */
const listCoupons = async (req, res) => {
  try {
    const { active } = req.query;
    const db = await connectToMongoDB();
    const coupons = db.collection('coupons');

    const filter = {};
    if (active === 'true') filter.active = true;

    const cursor = coupons.find(filter).sort({ createdAt: -1 });
    const results = await cursor.toArray();

    // Remove internal fields if desired (eg. usedCount)
    return res.status(200).json({ coupons: results });
  } catch (error) {
    console.error('listCoupons error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Apply coupon
 * body: { code, basketTotal }
 * Returns { success, discountAmount, newTotal, message }
 */
const applyCoupon = async (req, res) => {
  try {
    const { code, basketTotal } = req.body;
    if (!code || basketTotal == null) {
      return res.status(400).json({ message: 'code and basketTotal are required' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const db = await connectToMongoDB();
    const coupons = db.collection('coupons');

    const coupon = await coupons.findOne({ code: normalizedCode });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // Check active
    if (!coupon.active) {
      return res.status(400).json({ message: 'Coupon is not active' });
    }

    // Check expiry
    const now = new Date();
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      return res.status(400).json({ message: 'Coupon has expired' });
    }

    // Check usage limit
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    // Compute discount
    const total = Number(basketTotal);
    if (isNaN(total) || total < 0) {
      return res.status(400).json({ message: 'Invalid basketTotal' });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (total * Number(coupon.discountValue)) / 100;
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Number(coupon.discountValue);
    }
    // Ensure discount does not exceed total
    if (discountAmount > total) discountAmount = total;

    const newTotal = Number((total - discountAmount).toFixed(2));

    // Optionally increase usedCount (we can require applying to an order to increment; this increments on apply)
    await coupons.updateOne(
      { _id: coupon._id },
      { $inc: { usedCount: 1 } }
    );

    return res.status(200).json({
      success: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      newTotal,
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    console.error('applyCoupon error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  createCoupon,
  listCoupons,
  applyCoupon
};
