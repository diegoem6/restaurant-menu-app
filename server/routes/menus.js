const router = require('express').Router();
const Menu = require('../models/Menu');
const Subcategory = require('../models/Subcategory');
const { auth } = require('../middleware/auth');

const canAccess = (user, menu) =>
  user.role === 'admin' || menu.owner.toString() === user._id.toString();

const populateMenu = (q) =>
  q.populate({
    path: 'categories.category',
    populate: { path: 'dishes.dish' },
  });

// Attach subcategories to each category in a populated menu object
const attachSubcategories = async (menuDoc) => {
  const obj = menuDoc.toObject ? menuDoc.toObject() : menuDoc;
  const catIds = obj.categories
    .map((c) => c.category?._id || c.category)
    .filter(Boolean);

  if (catIds.length === 0) return obj;

  const subcategories = await Subcategory.find({ category: { $in: catIds } })
    .populate('dishes.dish')
    .sort({ order: 1 });

  obj.categories = obj.categories.map((catEntry) => {
    const catId = (catEntry.category?._id || catEntry.category)?.toString();
    if (!catId) return catEntry;
    return {
      ...catEntry,
      category: {
        ...catEntry.category,
        subcategories: subcategories.filter((s) => s.category.toString() === catId),
      },
    };
  });

  return obj;
};

// GET /api/menus
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const menus = await populateMenu(Menu.find(filter)).sort({ createdAt: -1 });
    res.json(menus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/menus/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const menu = await populateMenu(Menu.findById(req.params.id));
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    if (!canAccess(req.user, menu))
      return res.status(403).json({ message: 'Forbidden' });
    res.json(await attachSubcategories(menu));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/menus
router.post('/', auth, async (req, res) => {
  try {
    const { name, backgroundTemplate, logo, font } = req.body;
    const menu = await Menu.create({
      name,
      backgroundTemplate: backgroundTemplate || { type: 'preset', preset: 'cream' },
      logo: logo || null,
      font: font || 'Playfair Display',
      categories: [],
      owner: req.user._id,
    });
    res.status(201).json(menu);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/menus/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    if (!canAccess(req.user, menu))
      return res.status(403).json({ message: 'Forbidden' });

    const { name, backgroundTemplate, logo, font } = req.body;
    if (name !== undefined) menu.name = name;
    if (backgroundTemplate !== undefined) menu.backgroundTemplate = backgroundTemplate;
    if (logo !== undefined) menu.logo = logo;
    if (font !== undefined) menu.font = font;
    await menu.save();
    await menu.populate({ path: 'categories.category', populate: { path: 'dishes.dish' } });
    res.json(await attachSubcategories(menu));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/menus/:id/categories — update categories list with ordering
router.put('/:id/categories', auth, async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    if (!canAccess(req.user, menu))
      return res.status(403).json({ message: 'Forbidden' });

    // categories: [{ category: id, order: number }]
    menu.categories = req.body.categories || [];
    await menu.save();
    await menu.populate({ path: 'categories.category', populate: { path: 'dishes.dish' } });
    res.json(await attachSubcategories(menu));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/menus/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    if (!canAccess(req.user, menu))
      return res.status(403).json({ message: 'Forbidden' });
    await menu.deleteOne();
    res.json({ message: 'Menu deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
