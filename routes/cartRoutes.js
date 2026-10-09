// backend/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const { protect } = require('../middleware/authMiddleware');

// 1. Get Logged-in User's Cart (GET)
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      return res.json({ user: req.user._id, items: [] });
    }
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add Item to Cart / Update Quantity (POST)
router.post('/', protect, async (req, res) => {
  const { productId, quantity, variant = {} } = req.body;
  const selectedVariant = {
    size: String(variant.size || '').trim(),
    color: String(variant.color || '').trim()
  };
  try {
    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      // Check if product already exists in cart
      const itemIndex = cart.items.findIndex((item) =>
        item.product.toString() === productId &&
        (item.variant?.size || '') === selectedVariant.size &&
        (item.variant?.color || '') === selectedVariant.color
      );

      if (itemIndex > -1) {
        // Agar product pehle se cart mein hai, toh quantity update kar dein
        cart.items[itemIndex].quantity += Number(quantity);
      } else {
        // Agar naya product hai, toh items array mein push kar dein
        cart.items.push({ product: productId, quantity: Number(quantity), variant: selectedVariant });
      }

      await cart.save();
      const updatedCart = await Cart.findById(cart._id).populate('items.product');
      return res.status(200).json(updatedCart);
    } else {
      // Agar user ka pehla cart hai, toh naya cart create karein
      const newCart = await Cart.create({
        user: req.user._id,
        items: [{ product: productId, quantity: Number(quantity), variant: selectedVariant }]
      });
      const populatedCart = await Cart.findById(newCart._id).populate('items.product');
      return res.status(201).json(populatedCart);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Remove an item from the logged-in user's cart
router.delete('/:productId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.json({ user: req.user._id, items: [] });

    const { itemId } = req.query;
    cart.items = cart.items.filter((item) => itemId
      ? item._id.toString() !== itemId
      : item.product.toString() !== req.params.productId);
    if (cart.items.length === 0) {
      await Cart.findByIdAndDelete(cart._id);
      return res.json({ user: req.user._id, items: [] });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.product');
    res.json(updatedCart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
