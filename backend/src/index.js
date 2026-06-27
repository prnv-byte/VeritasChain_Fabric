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
app.use('/requirements',  require('./routes/requirements'));
app.use('/channel-reqs', require('./routes/channelReqs'));
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
        await restartOrgContainers(org.toObject()).catch(err =>
          console.error(`[startup] Failed to restart containers for ${org.slug}:`, err.message)
        );
      }
    }

    if (activeChannels.length) {
      console.log(`[startup] Restarting orderers for ${activeChannels.length} active channel(s)...`);
      for (const ch of activeChannels) {
        await restartChannelOrderer(ch.toObject()).catch(err =>
          console.error(`[startup] Failed to restart orderer for ${ch.channelName}:`, err.message)
        );
      }
    }

    // Heal ZK keys stuck in 'generating' from a previous run that was interrupted.
    // If the pk file already exists on disk → mark ready. Otherwise re-run vc-setup.
    const path = require('path');
    const fs   = require('fs');
    const ChannelRequirement = require('./models/ChannelRequirement');
    const { runSetupForReq } = require('./routes/channelReqs');

    const stuckZK = await ChannelRequirement.find({ zkeyStatus: 'generating' });
    if (stuckZK.length) {
      console.log(`[startup] Found ${stuckZK.length} ZK requirement(s) stuck in 'generating' — healing...`);
      for (const req of stuckZK) {
        const pkPath = req.pkPath || path.join(__dirname, '..', 'keys', 'channels', req.channelId.toString(), 'circuit.pk');
        const vkPath = req.vkPath || path.join(__dirname, '..', 'keys', 'channels', req.channelId.toString(), 'circuit.vk');
        if (fs.existsSync(pkPath) && fs.existsSync(vkPath)) {
          console.log(`[startup] ZK keys already on disk for channel ${req.channelId} — marking ready.`);
          await ChannelRequirement.findByIdAndUpdate(req._id, { zkeyStatus: 'ready', pkPath, vkPath });
        } else {
          console.log(`[startup] Re-running vc-setup for channel ${req.channelId}...`);
          runSetupForReq(req).catch(err => console.error(`[startup] vc-setup re-run failed:`, err.message));
        }
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
