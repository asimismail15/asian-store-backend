const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));

// Product Routes Import aur Mount karna
const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// Auth Routes Import aur Mount karna
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Cart Routes Import aur Mount karna
const cartRoutes = require('./routes/cartRoutes');
app.use('/api/cart', cartRoutes);

// Order Routes Import aur Mount karna
const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

// User Profile Routes Import aur Mount karna (New)
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Mongoose 6+ enables the modern parser and topology by default; legacy flags are unsupported.
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.info('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.send('ASIAN STORE Backend is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}`);
});
