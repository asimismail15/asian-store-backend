require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const products = [
  { title: 'Studio Arc Wireless Headphones', category: 'Electronics', price: 129.99, stock: 18, rating: 4.8, numReviews: 126, description: 'Immersive sound, adaptive noise cancellation, and a lightweight over-ear fit for all-day listening.', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85' },
  { title: 'Sonder Portable Bluetooth Speaker', category: 'Electronics', price: 89.50, stock: 24, rating: 4.7, numReviews: 82, description: 'Room-filling audio in a compact, water-resistant form with a warm, tactile finish.', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1200&q=85' },
  { title: 'Form No. 02 Minimal Watch', category: 'Accessories', price: 155, stock: 9, rating: 4.6, numReviews: 54, description: 'A considered timepiece with a brushed steel case, clean dial, and supple leather strap.', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85' },
  { title: 'Relaxed Linen Shirt', category: 'Fashion', price: 74, stock: 15, rating: 4.5, numReviews: 31, description: 'A breathable relaxed-fit linen shirt designed to move easily from morning to evening.', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=85', sizes: ['S', 'M', 'L', 'XL'], colors: ['Sand', 'Olive'] },
  { title: 'Daylight Crossbody Bag', category: 'Fashion', price: 112, stock: 7, rating: 4.7, numReviews: 48, description: 'A compact carryall with thoughtful pockets, a soft structure, and a comfortable adjustable strap.', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85' },
  { title: 'Sculpted Ceramic Vase', category: 'Home & Living', price: 48, stock: 12, rating: 4.8, numReviews: 42, description: 'An artful hand-finished ceramic vessel that brings a quiet focal point to any room.', image: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=1200&q=85' },
  { title: 'Halo Bedside Table Lamp', category: 'Home & Living', price: 94, stock: 11, rating: 4.6, numReviews: 38, description: 'Soft ambient light, a sculptural silhouette, and a dimmable glow for slow evenings.', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85' },
  { title: 'Morning Ritual Coffee Set', category: 'Kitchen', price: 62, stock: 16, rating: 4.8, numReviews: 67, description: 'Tactile stoneware cups made for taking a slower, more thoughtful coffee break.', image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=85' },
];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required to seed products.');
  await mongoose.connect(process.env.MONGO_URI);
  const operations = products.map((product) => ({
    updateOne: {
      filter: { title: product.title },
      update: { $setOnInsert: { ...product, images: [product.image] } },
      upsert: true,
    },
  }));
  const result = await Product.bulkWrite(operations, { ordered: true });
  console.info(`Seed complete: ${result.upsertedCount} inserted, ${result.matchedCount} already present.`);
}

seed().catch((error) => {
  console.error('Product seed failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
