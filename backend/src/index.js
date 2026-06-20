'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const { connectDB } = require('./config/db');
const { restartOrgContainers, restartChannelOrderer } = require('./fabric/provisioner');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'veritaschain-backend' }));

// Routes
app.use('/orgs',     require('./routes/orgs'));
app.use('/auth',      require('./routes/auth'));
app.use('/channels', require('./routes/channels'));
app.use('/orders',       require('./routes/orders'));
app.use('/requirements', require('./routes/requirements'));
app.use('/admin',        require('./routes/admin'));

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

    // Restart containers for all active orgs and channels.
    // Crypto material is already on disk — this is just docker run, no re-enrollment.
    const [activeOrgs, activeChannels] = await Promise.all([
      Org.find({ fabricStatus: 'active' }),
      Channel.find({ status: 'active' }),
    ]);

    if (activeOrgs.length) {
      console.log(`[startup] Restarting containers for ${activeOrgs.length} active org(s)...`);
      for (const org of activeOrgs) {
        restartOrgContainers(org.toObject()).catch(err =>
          console.error(`[startup] Failed to restart containers for ${org.slug}:`, err.message)
        );
      }
    }

    if (activeChannels.length) {
      console.log(`[startup] Restarting orderers for ${activeChannels.length} active channel(s)...`);
      for (const ch of activeChannels) {
        restartChannelOrderer(ch.toObject()).catch(err =>
          console.error(`[startup] Failed to restart orderer for ${ch.channelName}:`, err.message)
        );
      }
    }

    app.listen(PORT, () => {
      console.log(`VeritasChain backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
