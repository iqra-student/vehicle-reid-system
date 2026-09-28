// One-time cleanup: marks every congestion alert that is still active as dismissed.
// Nothing is deleted — the alerts stay in the database, they just stop counting as "active".
//
// Run from the server folder:
//   node scripts/dismissAllAlerts.js

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same as server.js (needed for MongoDB Atlas on some networks)

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Congestion = require('../models/Congestion');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await Congestion.updateMany(
      { resolved: false },
      { $set: { resolved: true, resolvedAt: new Date(), resolvedBy: 'cleanup-script' } }
    );
    console.log(`Dismissed ${result.modifiedCount} active alert(s). Active alerts are now 0.`);
  } catch (err) {
    console.error('Cleanup failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();