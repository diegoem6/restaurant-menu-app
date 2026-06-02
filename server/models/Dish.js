const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  menuName: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  prices: [{
    label: { type: String, trim: true, default: '' },
    priceUYU: { type: Number, required: true, min: 0 },
    priceUSD: { type: Number, default: null },
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Dish', dishSchema);
