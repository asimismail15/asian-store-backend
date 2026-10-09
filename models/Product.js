const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  verifiedPurchase: { type: Boolean, default: false }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  images: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  colors: { type: [String], default: [] },
  stock: { type: Number, required: true, default: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  numReviews: { type: Number, default: 0, min: 0 },
  reviews: { type: [reviewSchema], default: [] },
}, { timestamps: true });

// Safe export to prevent model overwrite errors
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
