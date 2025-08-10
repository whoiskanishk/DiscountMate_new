// src/routers/coupon.router.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const couponController = require('../controllers/coupon.controller');

// Simple middleware to ensure JWT exists and decode
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { email, admin, ... } if present in token
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'No user in request' });
  if (!req.user.admin) return res.status(403).json({ message: 'Admin only' });
  next();
};

// Create coupon (admin only)
router.post('/', requireAuth, requireAdmin, couponController.createCoupon);

// List coupons (public) - for convenience allow query param ?active=true
router.get('/', couponController.listCoupons);

// Apply coupon (could be protected or public)
router.post('/apply', couponController.applyCoupon);

module.exports = router;
