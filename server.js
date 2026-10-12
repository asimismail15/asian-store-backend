const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URLS || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000,http://localhost:3001' : ''))
  .split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header are server-to-server/CLI health checks.
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
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

app.get('/', (req, res) => {
  res.send('ASIAN STORE Backend is running!');
});

app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? 'ok' : 'unavailable', database: databaseReady ? 'connected' : 'disconnected' });
});

const PORT = process.env.PORT || 5000;
async function start() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured before starting the API.');
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('Set FRONTEND_URLS to a comma-separated list of allowed storefront origins in production.');
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.info('MongoDB connected successfully');
  app.listen(PORT, '0.0.0.0', () => console.info(`ASIAN STORE API listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('API startup failed:', err.message);
  process.exitCode = 1;
});
