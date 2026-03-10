require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Settings = require('./models/Settings');

async function init() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_menus');
    console.log('✅ Connected to MongoDB');

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existing = await User.findOne({ username: adminUsername });
    if (existing) {
      console.log(`⚠️  Admin user "${adminUsername}" already exists`);
    } else {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await User.create({ username: adminUsername, password: hashed, role: 'admin' });
      console.log(`✅ Admin user created: ${adminUsername} / ${adminPassword}`);
    }

    // Create default settings
    const rateExists = await Settings.findOne({ key: 'exchangeRate' });
    if (!rateExists) {
      await Settings.create({ key: 'exchangeRate', value: '40' });
      console.log('✅ Default exchange rate set: 40 UYU per USD');
    }

    console.log('🎉 Initialization complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Init error:', err);
    process.exit(1);
  }
}

init();
