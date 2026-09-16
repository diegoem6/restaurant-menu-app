const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  categoryFontSize: { type: Number, default: 36, min: 8, max: 120 },
  dishFontSize: { type: Number, default: 20, min: 8, max: 80 },
  categoryTitleBold: { type: Boolean, default: true },
  subcategoryTitleBold: { type: Boolean, default: true },
  dishNameBold: { type: Boolean, default: true },
  dishes: [{
    dish: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
    order: { type: Number, default: 0 },
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
