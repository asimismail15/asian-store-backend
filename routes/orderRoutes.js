// backend/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendOrderNotification } = require('../services/notifications');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 1. Create New Order from Cart (POST)
router.post('/', protect, async (req, res) => {
  try {
    const { shippingAddress } = req.body;
    const allowedPaymentMethods = ['easypaisa', 'jazzcash', 'card', 'cod'];
    const paymentMethod = allowedPaymentMethods.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'cod';
    const senderDigits = String(req.body.paymentSenderPhone || '').replace(/\D/g, '');
    const paymentTransactionId = String(req.body.paymentTransactionId || '').trim();
    if (['easypaisa', 'jazzcash'].includes(paymentMethod) && !/^03\d{9}$/.test(senderDigits)) {
      return res.status(400).json({ message: 'Enter a valid 11-digit sender phone number.' });
    }
    if (['easypaisa', 'jazzcash'].includes(paymentMethod) && (paymentTransactionId.length < 6 || paymentTransactionId.length > 120)) {
      return res.status(400).json({ message: 'Enter a valid transaction ID (at least 6 characters).'});
    }
    if (['easypaisa', 'jazzcash'].includes(paymentMethod) && await Order.exists({ paymentTransactionId })) {
      return res.status(409).json({ message: 'This transaction ID has already been submitted for an order.' });
    }
    const giftOptions = req.body.giftOptions || {};
    const giftMessage = typeof giftOptions.giftMessage === 'string' ? giftOptions.giftMessage.trim().slice(0, 300) : '';

    // User ka cart find karein
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Aapka cart khaali hai!" });
    }

    // Order items prepare karein aur total price calculate karein
    let totalPrice = 0;
    const orderItems = cart.items.map((item) => {
      const itemTotalPrice = item.product.price * item.quantity;
      totalPrice += itemTotalPrice;
      return {
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        variant: item.variant || {}
      };
    });

    // Order create karein
    const order = await Order.create({
      user: req.user._id,
      notificationEmail: req.body.shippingAddress?.email || req.user.email,
      orderItems,
      shippingAddress,
      giftOptions: { giftWrapped: giftOptions.giftWrapped === true, giftMessage },
      paymentMethod,
      paymentStatus: ['easypaisa', 'jazzcash'].includes(paymentMethod) ? 'Pending Verification' : paymentMethod === 'cod' ? 'COD' : 'Pending Verification',
      paymentAccountLast4: ['easypaisa', 'jazzcash'].includes(paymentMethod) ? senderDigits.slice(-4) : '',
      paymentSenderPhone: ['easypaisa', 'jazzcash'].includes(paymentMethod) ? senderDigits : '',
      paymentTransactionId: ['easypaisa', 'jazzcash'].includes(paymentMethod) ? paymentTransactionId : '',
      totalPrice
    });

    await sendOrderNotification({ to: req.body.shippingAddress?.email || req.user.email, orderId: order._id, status: order.status, kind: 'confirmation' });

    // Order banne ke baad cart ko khaali (clear) kar dein
    await Cart.findOneAndDelete({ user: req.user._id });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public tracking lookup: an email returns only orders owned by its matching account.
router.get('/track', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();
    if (!query) return res.status(400).json({ message: 'Enter an order ID or email address.' });
    let order;
    if (/^[a-f\d]{24}$/i.test(query)) {
      order = await Order.findById(query).populate('user', 'email');
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)) {
      const User = require('../models/user');
      const user = await User.findOne({ email: query.toLowerCase() }).select('_id');
      const ownership = user ? [{ user: user._id }] : [];
      order = await Order.findOne({ $or: [...ownership, { notificationEmail: query.toLowerCase() }] }).sort({ createdAt: -1 });
    } else {
      return res.status(404).json({ message: 'No matching order was found. Check the order ID or checkout email.' });
    }
    if (!order) return res.status(404).json({ message: 'No matching order was found. Check the order ID or checkout email.' });
    const result = order.toObject();
    delete result.user;
    delete result.notificationEmail;
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Order tracking is temporarily unavailable.' });
  }
});

// 2. Get Logged-in User's Orders (GET)
router.get('/myorders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('orderItems.product');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get All Orders (Admin Only) (GET)
router.get('/', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'name email').populate('orderItems.product');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update Order Status to Delivered (Admin Only) (PUT)
router.put('/:id/deliver', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order nahi mila!" });
    }
    if (['easypaisa', 'jazzcash'].includes(order.paymentMethod) && order.paymentStatus === 'Pending Verification') {
      return res.status(400).json({ message: 'Verify the wallet transaction before marking this order delivered.' });
    }

    const statusChanged = order.status !== 'Delivered';
    order.isDelivered = true;
    order.deliveredAt = Date.now();
    order.status = 'Delivered';

    const updatedOrder = await order.save();
    if (statusChanged) {
      const User = require('../models/user');
      const customer = await User.findById(order.user).select('email');
      await sendOrderNotification({ to: order.notificationEmail || customer?.email, orderId: order._id, status: order.status, kind: 'status-update' });
    }
    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const allowed = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid order status.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order nahi mila!' });
    const fulfillmentStatuses = ['Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'];
    if (['easypaisa', 'jazzcash'].includes(order.paymentMethod) && order.paymentStatus === 'Pending Verification' && fulfillmentStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: 'Verify the wallet transaction before moving this order to fulfillment.' });
    }
    if (order.status !== req.body.status) {
      order.status = req.body.status;
      if (req.body.status === 'Delivered') { order.isDelivered = true; order.deliveredAt = Date.now(); }
      const updatedOrder = await order.save();
      const User = require('../models/user');
      const customer = await User.findById(order.user).select('email');
      await sendOrderNotification({ to: customer?.email, orderId: order._id, status: order.status, kind: 'status-update' });
      return res.json(updatedOrder);
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create Stripe Payment Intent (POST) - Updated
router.post('/create-payment-intent', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.body.orderId, user: req.user._id, paymentMethod: 'card', isPaid: false });
    if (!order) return res.status(404).json({ message: 'Pending card order was not found.' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'usd',
      metadata: { orderId: String(order._id), userId: String(req.user._id) },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    order.paymentReference = paymentIntent.id;
    await order.save();

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Update Order to Paid (PUT)
router.put('/:id/pay', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id, paymentMethod: 'card' });

    if (!order) {
      return res.status(404).json({ message: "Order nahi mila!" });
    }

    const paymentIntentId = String(req.body.id || '');
    if (!paymentIntentId || paymentIntentId !== order.paymentReference) return res.status(400).json({ message: 'Payment reference does not match this order.' });
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded' || intent.metadata.orderId !== String(order._id) || intent.metadata.userId !== String(req.user._id)) {
      return res.status(400).json({ message: 'The card payment has not been confirmed by Stripe.' });
    }
    const statusChanged = order.status !== 'Processing';
    order.isPaid = true;
    order.paidAt = Date.now();
    order.status = 'Processing';
    order.paymentStatus = 'Paid via Card';
    order.paymentResult = {
      id: paymentIntentId,
      status: intent.status,
      update_time: req.body.update_time || new Date().toISOString(),
      email_address: req.body.email_address || req.user.email
    };

    const updatedOrder = await order.save();
    if (statusChanged) await sendOrderNotification({ to: order.notificationEmail || req.body.email_address || req.user.email, orderId: order._id, status: order.status, kind: 'status-update' });
    res.json(updatedOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin manually confirms external wallet transfers after checking the provider transaction.
router.put('/:id/payment-status', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (!['easypaisa', 'jazzcash'].includes(order.paymentMethod) || order.paymentStatus !== 'Pending Verification') return res.status(400).json({ message: 'This order is not awaiting manual wallet verification.' });
    if (!order.paymentSenderPhone || !order.paymentTransactionId) return res.status(400).json({ message: 'The order is missing its sender number or transaction ID.' });
    const duplicate = await Order.exists({ _id: { $ne: order._id }, paymentTransactionId: order.paymentTransactionId });
    if (duplicate) return res.status(409).json({ message: 'This transaction ID is already linked to another order.' });
    order.paymentStatus = 'Paid / Approved';
    order.paymentReference = order.paymentTransactionId;
    order.isPaid = true;
    order.paidAt = new Date();
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
