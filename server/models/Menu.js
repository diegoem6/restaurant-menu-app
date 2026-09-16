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
  titleFontColor: { type: String, default: null },
  categoryFontColor: { type: String, default: null },
  dishFontColor: { type: String, default: null },
  pdfTopMargin: { type: Number, default: 0, min: 0, max: 300 },
  pdfBottomMargin: { type: Number, default: 0, min: 0, max: 300 },
  pdfLeftMargin: { type: Number, default: 0, min: 0, max: 300 },
  pdfRightMargin: { type: Number, default: 0, min: 0, max: 300 },
  dishSpacing: { type: Number, default: 16, min: 0, max: 80 },
  categories: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    order: { type: Number, default: 0 },
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
