'use strict';

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI ;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB connected: ${MONGODB_URI}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
}

mongoose.connection.once('open', async () => {
  try {
    await mongoose.connection.db.collection('orgs').dropIndex('name_1');
    console.log("Successfully removed old unique organization name index constraint.");
  } catch (err) {
    // Ignores error if index was already dropped
  }
});

module.exports = { connectDB };
