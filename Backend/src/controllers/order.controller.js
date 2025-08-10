// src/controllers/order.controller.js
const { connectToMongoDB } = require('../config/database');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

// Create order from basket
const createOrder = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const { items, totalAmount, couponCode } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0 || totalAmount == null) {
            return res.status(400).json({ message: 'Invalid order data' });
        }

        const db = await connectToMongoDB();
        const ordersCol = db.collection('orders');

        let finalTotal = Number(totalAmount);
        let appliedCoupon = null;

        // Optional: Apply coupon
        if (couponCode) {
            const coupon = await db.collection('coupons').findOne({ code: couponCode.toUpperCase(), active: true });
            if (coupon) {
                const now = new Date();
                if (coupon.expiryDate && new Date(coupon.expiryDate) >= now) {
                    let discountAmount = 0;
                    if (coupon.discountType === 'percentage') {
                        discountAmount = (finalTotal * Number(coupon.discountValue)) / 100;
                    } else if (coupon.discountType === 'fixed') {
                        discountAmount = Number(coupon.discountValue);
                    }
                    if (discountAmount > finalTotal) discountAmount = finalTotal;
                    finalTotal = Number((finalTotal - discountAmount).toFixed(2));

                    appliedCoupon = {
                        code: coupon.code,
                        discountType: coupon.discountType,
                        discountValue: coupon.discountValue,
                        discountAmount
                    };

                    await db.collection('coupons').updateOne(
                        { _id: coupon._id },
                        { $inc: { usedCount: 1 } }
                    );
                }
            }
        }

        const order = {
            userEmail: decoded.email,
            items,
            totalAmount: Number(totalAmount),
            finalTotal,
            coupon: appliedCoupon,
            status: 'pending',
            createdAt: new Date()
        };

        const result = await ordersCol.insertOne(order);
        res.status(201).json({ message: 'Order placed successfully', orderId: result.insertedId });

    } catch (error) {
        console.error('createOrder error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Get all orders for logged-in user
const getUserOrders = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const db = await connectToMongoDB();
        const orders = await db.collection('orders').find({ userEmail: decoded.email }).sort({ createdAt: -1 }).toArray();

        res.status(200).json({ orders });
    } catch (error) {
        console.error('getUserOrders error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Get specific order by ID
const getOrderById = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const orderId = req.params.id;
        const db = await connectToMongoDB();
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });

        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (!decoded.admin && order.userEmail !== decoded.email) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.status(200).json({ order });
    } catch (error) {
        console.error('getOrderById error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Update order status (Admin only)
const updateOrderStatus = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ message: 'Invalid token' });
        }

        if (!decoded.admin) return res.status(403).json({ message: 'Admin only' });

        const { status } = req.body;
        if (!['pending', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const orderId = req.params.id;
        const db = await connectToMongoDB();
        const result = await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('updateOrderStatus error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderById,
    updateOrderStatus
};
