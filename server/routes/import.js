const router = require('express').Router();
const Dish = require('../models/Dish');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { auth } = require('../middleware/auth');

const canAccess = (user, doc) =>
  user.role === 'admin' || doc.owner.toString() === user._id.toString();

// POST /api/import/dishes — bulk-create dishes from a parsed spreadsheet
// body: { items: [{ name, menuName, description, prices: [{label, priceUYU}], categoryId, subcategoryId }] }
router.post('/dishes', auth, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: 'No hay filas para importar' });

    const categoryIds = [...new Set(items.map((i) => i.categoryId).filter(Boolean))];
    const subcategoryIds = [...new Set(items.map((i) => i.subcategoryId).filter(Boolean))];

    const [categories, subcategories] = await Promise.all([
      Category.find({ _id: { $in: categoryIds } }),
      Subcategory.find({ _id: { $in: subcategoryIds } }),
    ]);
    const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
    const subMap = new Map(subcategories.map((s) => [s._id.toString(), s]));

    for (const id of categoryIds) {
      const cat = catMap.get(id);
      if (!cat || !canAccess(req.user, cat))
        return res.status(403).json({ message: 'Categoría inválida' });
    }
    for (const id of subcategoryIds) {
      const sub = subMap.get(id);
      if (!sub || !canAccess(req.user, sub))
        return res.status(403).json({ message: 'Subcategoría inválida' });
    }

    const errors = [];
    let createdCount = 0;
    const dirtyCategories = new Set();
    const dirtySubcategories = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowLabel = item.name || `Fila ${i + 1}`;
      try {
        const prices = (item.prices || [])
          .map((p) => ({ label: p.label || '', priceUYU: Number(p.priceUYU) }))
          .filter((p) => !isNaN(p.priceUYU) && p.priceUYU >= 0);

        if (!item.name || !item.name.trim()) {
          errors.push({ row: i, name: rowLabel, message: 'Falta el nombre del plato' });
          continue;
        }
        if (!prices.length) {
          errors.push({ row: i, name: rowLabel, message: 'Falta un precio válido' });
          continue;
        }

        const dish = await Dish.create({
          name: item.name.trim(),
          menuName: item.menuName || '',
          description: item.description || '',
          prices,
          owner: req.user._id,
        });
        createdCount++;

        const sub = item.subcategoryId ? subMap.get(item.subcategoryId) : null;
        const cat = item.categoryId ? catMap.get(item.categoryId) : null;
        if (sub) {
          sub.dishes.push({ dish: dish._id, order: sub.dishes.length });
          dirtySubcategories.add(sub._id.toString());
        } else if (cat) {
          cat.dishes.push({ dish: dish._id, order: cat.dishes.length });
          dirtyCategories.add(cat._id.toString());
        }
      } catch (err) {
        errors.push({ row: i, name: rowLabel, message: err.message });
      }
    }

    await Promise.all([
      ...[...dirtyCategories].map((id) => catMap.get(id).save()),
      ...[...dirtySubcategories].map((id) => subMap.get(id).save()),
    ]);

    res.status(201).json({ createdCount, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
