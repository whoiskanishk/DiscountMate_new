// src/controllers/admin.controller.js
const { connectToMongoDB } = require('../config/database');
const jwt = require('jsonwebtoken');

// Middleware-like helper for admin check
const checkAdmin = (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw { status: 401, message: 'No token provided' };

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        throw { status: 401, message: 'Invalid token' };
    }

    if (!decoded.admin) throw { status: 403, message: 'Admin only' };
    return decoded;
};

// 1. Get all users (basic details)
const getAllUsers = async (req, res) => {
    try {
        checkAdmin(req);

        const db = await connectToMongoDB();
        const users = await db.collection('users')
            .find({}, { projection: { encrypted_password: 0 } })
            .sort({ user_fname: 1 })
            .toArray();

        res.status(200).json({ users });
    } catch (error) {
        console.error('getAllUsers error:', error);
        res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
};

// 2. Sales report (total revenue, orders count, per month stats)
const getSalesReport = async (req, res) => {
    try {
        checkAdmin(req);

        const db = await connectToMongoDB();
        const orders = db.collection('orders');

        // Aggregate total sales, total orders, and group by month/year
        const pipeline = [
            {
                $group: {
                    _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                    totalRevenue: { $sum: "$finalTotal" },
                    totalOrders: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ];

        const monthlyStats = await orders.aggregate(pipeline).toArray();
        const overallStats = await orders.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$finalTotal" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]).toArray();

        res.status(200).json({
            overall: overallStats[0] || { totalRevenue: 0, totalOrders: 0 },
            monthly: monthlyStats
        });
    } catch (error) {
        console.error('getSalesReport error:', error);
        res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
};

// 3. Product analytics (top selling products)
const getProductAnalytics = async (req, res) => {
    try {
        checkAdmin(req);

        const db = await connectToMongoDB();
        const orders = db.collection('orders');

        const pipeline = [
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ];

        const topProducts = await orders.aggregate(pipeline).toArray();

        res.status(200).json({ topProducts });
    } catch (error) {
        console.error('getProductAnalytics error:', error);
        res.status(error.status || 500).json({ message: error.message || 'Internal Server Error' });
    }
};

module.exports = {
    getAllUsers,
    getSalesReport,
    getProductAnalytics
};
