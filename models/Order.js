// backend/models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  notificationEmail: { type: String, trim: true, lowercase: true },
  orderItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Product'
      },
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      variant: {
        size: { type: String, trim: true, default: "" },
        color: { type: String, trim: true, default: "" }
      }
    }
  ],
  shippingAddress: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  giftOptions: {
    giftWrapped: { type: Boolean, default: false },
    giftMessage: { type: String, trim: true, maxlength: 300, default: '' }
  },
  paymentMethod: { type: String, enum: ['easypaisa', 'jazzcash', 'card', 'cod'], default: 'cod', required: true },
  paymentStatus: { type: String, enum: ['Pending', 'Pending Verification', 'Paid / Approved', 'Paid via Card', 'COD'], default: 'COD', required: true },
  paymentReference: { type: String, trim: true, maxlength: 120, default: '' },
  paymentAccountLast4: { type: String, trim: true, maxlength: 4, default: '' },
  paymentSenderPhone: { type: String, trim: true, maxlength: 16, default: '' },
  paymentTransactionId: { type: String, trim: true, maxlength: 120, default: '' },
  paymentResult: {
    id: { type: String, default: '' },
    status: { type: String, default: '' },
    update_time: { type: Date }
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  isPaid: {
    type: Boolean,
    required: true,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    default: 'Pending' // Pending, Processing, Shipped, Delivered, Cancelled
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
