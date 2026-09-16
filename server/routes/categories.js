const router = require('express').Router();
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { auth } = require('../middleware/auth');

const canAccess = (user, cat) =>
  user.role === 'admin' || cat.owner.toString() === user._id.toString();

// GET /api/categories
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const cats = await Category.find(filter)
      .populate('dishes.dish')
      .sort({ createdAt: -1 });

    const catIds = cats.map((c) => c._id);
    const subcategories = await Subcategory.find({ category: { $in: catIds } })
      .populate('dishes.dish')
      .sort({ order: 1 });

    const result = cats.map((cat) => {
      const obj = cat.toObject();
      obj.subcategories = subcategories.filter(
        (s) => s.category.toString() === cat._id.toString()
      );
      return obj;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/categories/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id).populate('dishes.dish');
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (!canAccess(req.user, cat))
      return res.status(403).json({ message: 'Forbidden' });

    const subcategories = await Subcategory.find({ category: cat._id })
      .populate('dishes.dish')
      .sort({ order: 1 });

    const result = cat.toObject();
    result.subcategories = subcategories;
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/categories
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, categoryFontSize, dishFontSize, categoryTitleBold, subcategoryTitleBold, dishNameBold } = req.body;
    const cat = await Category.create({
      name,
      description,
      categoryFontSize: categoryFontSize ?? 36,
      dishFontSize: dishFontSize ?? 20,
      categoryTitleBold: categoryTitleBold ?? true,
      subcategoryTitleBold: subcategoryTitleBold ?? true,
      dishNameBold: dishNameBold ?? true,
      dishes: [],
      owner: req.user._id,
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (!canAccess(req.user, cat))
      return res.status(403).json({ message: 'Forbidden' });

    const { name, description, categoryFontSize, dishFontSize, categoryTitleBold, subcategoryTitleBold, dishNameBold } = req.body;
    if (name !== undefined) cat.name = name;
    if (description !== undefined) cat.description = description;
    if (categoryFontSize !== undefined) cat.categoryFontSize = categoryFontSize;
    if (dishFontSize !== undefined) cat.dishFontSize = dishFontSize;
    if (categoryTitleBold !== undefined) cat.categoryTitleBold = categoryTitleBold;
    if (subcategoryTitleBold !== undefined) cat.subcategoryTitleBold = subcategoryTitleBold;
    if (dishNameBold !== undefined) cat.dishNameBold = dishNameBold;
    await cat.save();
    await cat.populate('dishes.dish');
    res.json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/categories/:id/dishes — update dishes list with ordering
router.put('/:id/dishes', auth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (!canAccess(req.user, cat))
      return res.status(403).json({ message: 'Forbidden' });

    // dishes: [{ dish: id, order: number }]
    cat.dishes = req.body.dishes || [];
    await cat.save();
    await cat.populate('dishes.dish');
    res.json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (!canAccess(req.user, cat))
      return res.status(403).json({ message: 'Forbidden' });
    await cat.deleteOne();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
