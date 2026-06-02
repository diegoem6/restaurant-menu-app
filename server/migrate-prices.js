require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_menus');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const dishes = await db.collection('dishes').find({}).toArray();

    let migrated = 0;
    let skipped = 0;

    for (const dish of dishes) {
      const hasPricesArray = Array.isArray(dish.prices) && dish.prices.length > 0;
      const hasLegacyPrice = dish.priceUYU != null;

      if (hasPricesArray) {
        skipped++;
        continue;
      }

      if (!hasLegacyPrice) {
        console.log(`  ⚠️  Plato sin precio: "${dish.name}" (${dish._id}) — omitido`);
        skipped++;
        continue;
      }

      const priceEntry = {
        label: '',
        priceUYU: dish.priceUYU,
        priceUSD: dish.priceUSD ?? null,
      };

      await db.collection('dishes').updateOne(
        { _id: dish._id },
        {
          $set: { prices: [priceEntry] },
          $unset: { priceUYU: '', priceUSD: '' },
        }
      );

      console.log(`  ✅ "${dish.name}" → $${dish.priceUYU} UYU`);
      migrated++;
    }

    console.log(`\n🎉 Migración completa: ${migrated} platos migrados, ${skipped} omitidos`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración:', err);
    process.exit(1);
  }
}

migrate();
