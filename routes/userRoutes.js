// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { protect } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// 1. Get Logged-in User Profile (GET)
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User nahi mila!" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Update Logged-in User Profile (PUT)
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      // Agar password update karna ho
      if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        message: "Profile kamyabi ke sath update ho gayi!"
      });
    } else {
      res.status(404).json({ message: "User nahi mila!" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;