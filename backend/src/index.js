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
app.use('/admin',    require('./routes/admin'));

const PORT = process.env.PORT || 3000;

connectDB()
  .then(async () => {
    // On startup: any channel/org stuck in provisioning was orphaned by a previous
    // server restart mid-operation. Reset them to 'failed' so they can be retried.
    const Channel = require('./models/Channel');
    const Org     = require('./models/Org');
    const [stuckChannels, stuckOrgs] = await Promise.all([
      Channel.updateMany({ status: 'provisioning' }, { $set: { status: 'failed' } }),
      Org.updateMany({ fabricStatus: 'provisioning' }, { $set: { fabricStatus: 'failed' } }),
    ]);
    if (stuckChannels.modifiedCount) console.log(`[startup] Reset ${stuckChannels.modifiedCount} stuck provisioning channel(s) to failed.`);
    if (stuckOrgs.modifiedCount)     console.log(`[startup] Reset ${stuckOrgs.modifiedCount} stuck provisioning org(s) to failed.`);

    app.listen(PORT, () => {
      console.log(`VeritasChain backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
