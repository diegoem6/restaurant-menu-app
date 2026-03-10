const router = require('express').Router();
const Settings = require('../models/Settings');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/settings/exchangeRate — public for authenticated users
router.get('/exchangeRate', auth, async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'exchangeRate' });
    res.json({ value: setting ? parseFloat(setting.value) : 40 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings/exchangeRate — admin only
router.put('/exchangeRate', auth, adminOnly, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || isNaN(parseFloat(value)))
      return res.status(400).json({ message: 'Valid numeric value required' });

    const setting = await Settings.findOneAndUpdate(
      { key: 'exchangeRate' },
      { value: String(value) },
      { new: true, upsert: true }
    );
    res.json({ value: parseFloat(setting.value) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
