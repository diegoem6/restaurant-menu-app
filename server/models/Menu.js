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
  // Category/dish fonts fall back to `font` when unset — same override
  // pattern as *FontColor below, but for the font family instead of color.
  categoryFont: { type: String, default: null },
  dishFont: { type: String, default: null },
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
  // Free-floating decorations (text/images) placed on top of a page in the
  // carta designer. `page` is either 'cover' or a Category id (as a string) —
  // only that category's first physical page shows them.
  freeElements: [{
    page: { type: String, required: true },
    type: { type: String, enum: ['text', 'image'], required: true },
    x: { type: Number, default: 40 },
    y: { type: Number, default: 40 },
    width: { type: Number, default: 220 },
    height: { type: Number, default: 60 },
    zIndex: { type: Number, default: 0 },
    text: { type: String, default: '' },
    fontSize: { type: Number, default: 24 },
    color: { type: String, default: '#1c1917' },
    bold: { type: Boolean, default: false },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    src: { type: String, default: null }, // base64
    opacity: { type: Number, default: 1, min: 0, max: 1 },
  }],
  // Per-category custom position/size for the title block and for each
  // individual dish/subcategory unit in the carta designer. A category with
  // no entry here uses the automatic (classic) flowing layout — only
  // present once the user has switched that category to a custom layout.
  // A category in custom layout renders on a single page (no auto-pagination).
  blockLayout: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    titleBox: {
      x: Number, y: Number, width: Number, height: Number,
    },
    // One box per dish or subcategory header, keyed by `dish:<dishId>` or
    // `sub:<subcategoryId>` (see unitKey in CartaRender.jsx).
    dishBoxes: [{
      key: { type: String, required: true },
      x: Number, y: Number, width: Number, height: Number,
    }],
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
