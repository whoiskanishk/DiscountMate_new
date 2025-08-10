const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// All endpoints require admin — handled inside controller check
router.get('/users', adminController.getAllUsers);
router.get('/sales-report', adminController.getSalesReport);
router.get('/product-analytics', adminController.getProductAnalytics);

module.exports = router;
