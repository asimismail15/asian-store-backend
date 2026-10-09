// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/authMiddleware');

// 1. Signup API
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Yeh email pehle se registered hai!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'customer' // Default role 'customer'
        });

        const savedUser = await newUser.save();
        res.status(201).json({ 
            message: "User successfully signup ho gaya!", 
            userId: savedUser._id,
            role: savedUser.role 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Login API
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email ya password!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email ya password!" });
        }

        // JWT Token mein id ke sath role bhi shamil kar diya
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            'my_secret_key_123', 
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            message: "Login successful!", 
            token, 
            user: { id: user._id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get Logged-in User Profile (Protected Route)
router.get('/profile', protect, async (req, res) => {
    try {
        res.status(200).json(req.user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Admin Dashboard (Protected + Admin Only Route)
router.get('/admin-dashboard', protect, admin, async (req, res) => {
    try {
        const [totalUsers, totalProducts, totalOrders, revenueResult, monthlySales, monthlyUsers, ordersByStatus] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Order.countDocuments(),
            Order.aggregate([{ $match: { isPaid: true } }, { $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
            Order.aggregate([
                { $match: { isPaid: true } },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
                { $sort: { _id: -1 } },
                { $limit: 12 },
                { $sort: { _id: 1 } }
            ]),
            User.aggregate([
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, users: { $sum: 1 } } },
                { $sort: { _id: -1 } },
                { $limit: 12 },
                { $sort: { _id: 1 } }
            ]),
            Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
        ]);

        res.status(200).json({
            message: "Welcome Admin! Yeh route sirf admin access kar sakta hai.",
            metrics: {
                totalUsers,
                totalProducts,
                totalOrders,
                paidRevenue: revenueResult[0]?.total || 0,
                monthlySales,
                monthlyUsers,
                ordersByStatus
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Forgot Password API
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Is email par koi user mojood nahi hai!" });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

        await user.save();

        res.status(200).json({
            message: "Password reset token generate ho gaya!",
            resetToken // Postman testing ke liye
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Reset Password API
router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Reset token ghalat hai ya expire ho chuka hai!" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.status(200).json({ message: "Password kamyabi ke sath change ho gaya! Ab aap login kar sakte hain." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
