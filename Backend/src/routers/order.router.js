const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

// Create new order
router.post('/', orderController.createOrder);

// Get logged-in user's orders
router.get('/', orderController.getUserOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Update order status (Admin only — handled inside controller)
router.put('/:id/status', orderController.updateOrderStatus);

module.exports = router;
