const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  backgroundTemplate: {
    type: { type: String, enum: ['preset', 'custom'], default: 'preset' },
    preset: { type: String, default: 'cream' },
    customImage: { type: String, default: null }, // base64
  },
  logo: { type: String, default: null }, // base64
  font: { type: String, default: 'Playfair Display' },
  categories: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    order: { type: Number, default: 0 },
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
