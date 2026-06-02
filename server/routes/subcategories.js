const router = require('express').Router();
const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const { auth } = require('../middleware/auth');

const canAccess = (user, doc) =>
  user.role === 'admin' || doc.owner.toString() === user._id.toString();

// GET /api/subcategories?categoryId=xxx
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    if (req.query.categoryId) filter.category = req.query.categoryId;
    const subs = await Subcategory.find(filter)
      .populate('dishes.dish')
      .sort({ order: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/subcategories
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, order, categoryId } = req.body;
    const cat = await Category.findById(categoryId);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (!canAccess(req.user, cat)) return res.status(403).json({ message: 'Forbidden' });

    const sub = await Subcategory.create({
      name,
      description,
      order: order ?? 0,
      dishes: [],
      category: categoryId,
      owner: req.user._id,
    });
    res.status(201).json(sub);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/subcategories/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const sub = await Subcategory.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found' });
    if (!canAccess(req.user, sub)) return res.status(403).json({ message: 'Forbidden' });

    const { name, description, order } = req.body;
    if (name !== undefined) sub.name = name;
    if (description !== undefined) sub.description = description;
    if (order !== undefined) sub.order = order;
    await sub.save();
    await sub.populate('dishes.dish');
    res.json(sub);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/subcategories/:id/dishes
router.put('/:id/dishes', auth, async (req, res) => {
  try {
    const sub = await Subcategory.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found' });
    if (!canAccess(req.user, sub)) return res.status(403).json({ message: 'Forbidden' });

    sub.dishes = req.body.dishes || [];
    await sub.save();
    await sub.populate('dishes.dish');
    res.json(sub);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/subcategories/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const sub = await Subcategory.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subcategory not found' });
    if (!canAccess(req.user, sub)) return res.status(403).json({ message: 'Forbidden' });

    await sub.deleteOne();
    res.json({ message: 'Subcategory deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
