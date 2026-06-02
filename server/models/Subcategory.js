const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  order: { type: Number, default: 0 },
  dishes: [{
    dish: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
    order: { type: Number, default: 0 },
  }],
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Subcategory', subcategorySchema);
