const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/authMiddleware');

// 1. Get All Products with Search, Filter & Pagination (GET - Public)
router.get('/', async (req, res) => {
  try {
    const pageSize = 6;
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ message: 'Page must be a positive whole number.' });
    const rawKeyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
    if (rawKeyword.length > 80) return res.status(400).json({ message: 'Search terms must be 80 characters or fewer.' });

    const escapedKeyword = rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyword = escapedKeyword
      ? {
          title: {
            $regex: escapedKeyword,
            $options: 'i',
          },
        }
      : {};

    const category = req.query.category ? { category: req.query.category } : {};

    const count = await Product.countDocuments({ ...keyword, ...category });
    const products = await Product.find({ ...keyword, ...category })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      products,
      page,
      pages: Math.ceil(count / pageSize),
      totalProducts: count
    });
  } catch (err) {
    console.error('Product listing failed:', err.message);
    res.status(500).json({ message: 'Unable to load products.' });
  }
});

// 2. Get Single Product by ID (GET - Public)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid product id.' });
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product nahi mila!" });
    }
    res.json(product);
  } catch (err) {
    console.error('Product lookup failed:', err.message);
    res.status(500).json({ message: 'Unable to load this product.' });
  }
});

// 3. Create Product Review (POST - Protected)
router.post('/:id/reviews', protect, async (req, res) => {
  const { rating, comment } = req.body;
  const numericRating = Number(rating);
  const reviewComment = typeof comment === 'string' ? comment.trim() : '';

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: 'Choose a star rating from 1 to 5.' });
  }
  if (reviewComment.length < 10 || reviewComment.length > 1000) {
    return res.status(400).json({ message: 'Reviews must be between 10 and 1000 characters.' });
  }

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product nahi mila!' });
    }

    const verifiedPurchase = await Order.exists({
      user: req.user._id,
      isPaid: true,
      'orderItems.product': product._id
    });

    if (!verifiedPurchase) {
      return res.status(403).json({ message: 'Only customers with a paid order for this product can leave a verified review.' });
    }

    const alreadyReviewed = product.reviews.find(
      (review) => review.user && review.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You have already reviewed this product.' });
    }

    product.reviews.push({
      user: req.user._id,
      name: req.user.name,
      rating: numericRating,
      comment: reviewComment,
      verifiedPurchase: true
    });
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.numReviews;

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create / Add Product (POST - Protected + Admin Only)
router.post('/', protect, admin, async (req, res) => {
  try {
    const savedProduct = await Product.create(req.body);
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Update Product (PUT - Protected + Admin Only)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product nahi mila update karne ke liye!" });
    }
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Delete Product (DELETE - Protected + Admin Only)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product nahi mila delete karne ke liye!" });
    }
    res.json({ message: "Product kamyabi ke sath delete ho gaya!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
