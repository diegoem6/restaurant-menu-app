const router = require('express').Router();
const Dish = require('../models/Dish');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { auth } = require('../middleware/auth');

const canAccess = (user, dish) =>
  user.role === 'admin' || dish.owner.toString() === user._id.toString();

// GET /api/dishes
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const dishes = await Dish.find(filter).sort({ createdAt: -1 });
    res.json(dishes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dishes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const dish = await Dish.findById(req.params.id);
    if (!dish) return res.status(404).json({ message: 'Dish not found' });
    if (!canAccess(req.user, dish))
      return res.status(403).json({ message: 'Forbidden' });
    res.json(dish);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/dishes
router.post('/', auth, async (req, res) => {
  try {
    const { name, menuName, description, prices } = req.body;
    const dish = await Dish.create({
      name, menuName, description, prices: prices || [],
      owner: req.user._id,
    });
    res.status(201).json(dish);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/dishes/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const dish = await Dish.findById(req.params.id);
    if (!dish) return res.status(404).json({ message: 'Dish not found' });
    if (!canAccess(req.user, dish))
      return res.status(403).json({ message: 'Forbidden' });

    const { name, menuName, description, prices } = req.body;
    if (name !== undefined) dish.name = name;
    if (menuName !== undefined) dish.menuName = menuName;
    if (description !== undefined) dish.description = description;
    if (prices !== undefined) dish.prices = prices;
    await dish.save();
    res.json(dish);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/dishes/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const dish = await Dish.findById(req.params.id);
    if (!dish) return res.status(404).json({ message: 'Dish not found' });
    if (!canAccess(req.user, dish))
      return res.status(403).json({ message: 'Forbidden' });
    await dish.deleteOne();
    await Promise.all([
      Category.updateMany({ 'dishes.dish': dish._id }, { $pull: { dishes: { dish: dish._id } } }),
      Subcategory.updateMany({ 'dishes.dish': dish._id }, { $pull: { dishes: { dish: dish._id } } }),
    ]);
    res.json({ message: 'Dish deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
