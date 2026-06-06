'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const { connectDB } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'veritaschain-backend' }));

// Routes
app.use('/orgs',     require('./routes/orgs'));
app.use('/channels', require('./routes/channels'));
app.use('/orders',   require('./routes/orders'));

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`VeritasChain backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
