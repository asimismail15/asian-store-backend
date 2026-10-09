const jwt = require('jsonwebtoken');
const User = require('../models/user');

const protect = async (req, res, next) => {
    let token;

    // Check karo ke headers mein Authorization aur Bearer token aa raha hai ya nahi
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Token nikal lo ("Bearer <token>" mein se token alag karna)
            token = req.headers.authorization.split(' ')[1];

            // Token verify karo (wahi secret key jo login mein use ki thi)
            const decoded = jwt.verify(token, 'my_secret_key_123');

            // User ko database se dhoond kar req.user mein save kar do (password nikal kar)
            req.user = await User.findById(decoded.id).select('-password');

            next(); // Agle step par jane do
        } catch (error) {
            return res.status(401).json({ message: "Not authorized, token fail ho gaya!" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, token nahi mila!" });
    }
};

// Admin Middleware (Sirf Admin ko allow karne ke liye)
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Access denied! Yeh route sirf Admin ke liye hai." });
    }
};

module.exports = { protect, admin };