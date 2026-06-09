'use strict';

const express  = require('express');
const router   = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const path     = require('path');
const Org      = require('../models/Org');
const Channel  = require('../models/Channel');

const execAsync   = promisify(exec);
const NETWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'network');

// ── Admin key middleware ───────────────────────────────────────────────────────
function verifyAdminKey(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const key        = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expected   = (process.env.ADMIN_KEY || '').trim();
  if (!key || !expected || key !== expected) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin key' });
  }
  next();
}

router.use(verifyAdminKey);

// ── GET /admin/orgs ───────────────────────────────────────────────────────────
// List ALL orgs including banned ones
router.get('/orgs', async (req, res) => {
  try {
    const orgs = await Org.find({}).select('-__v').sort({ createdAt: -1 });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/orgs/:id/ban ──────────────────────────────────────────────────
// Ban an org — removes from platform immediately (MongoDB only, fast)
router.post('/orgs/:id/ban', async (req, res) => {
  try {
    const org = await Org.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Org not found' });
    if (org.fabricStatus === 'banned') {
      return res.status(400).json({ error: 'Org is already banned' });
    }
    await Org.findByIdAndUpdate(req.params.id, { fabricStatus: 'banned' });
    console.log(`[admin] Org "${org.name}" (${org.mspId}) banned.`);
    res.json({ message: `Org "${org.name}" banned from platform.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/orgs/:id/unban ────────────────────────────────────────────────
// Unban an org — restore platform access
router.post('/orgs/:id/unban', async (req, res) => {
  try {
    const org = await Org.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Org not found' });
    await Org.findByIdAndUpdate(req.params.id, { fabricStatus: 'active' });
    console.log(`[admin] Org "${org.name}" unbanned.`);
    res.json({ message: `Org "${org.name}" restored to active.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /admin/orgs/:id ────────────────────────────────────────────────────
// Full eviction — runs removeOrg.sh (Phase 1 + 2 + 3) then bans in MongoDB
router.delete('/orgs/:id', async (req, res) => {
  try {
    const org = await Org.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Org not found' });

    // Find the channel this org is part of
    const channel = await Channel.findOne({
      status: 'active',
      $or: [
        { manufacturerOrgId: org._id },
        { supplierOrgId:     org._id },
      ],
    }).populate('manufacturerOrgId supplierOrgId');

    if (channel) {
      // Find the remaining org on the channel
      const remainingOrg = channel.manufacturerOrgId._id.equals(org._id)
        ? channel.supplierOrgId
        : channel.manufacturerOrgId;

      const folderName = org.domain.replace('.veritaschain.com', '');

      const cmd = [
        `bash "${NETWORK_DIR}/scripts/removeOrg.sh"`,
        `"${org.mspId}"`,
        `"${org.domain}"`,
        `"${folderName}"`,
        `"${channel.channelName}"`,
        `"${remainingOrg.mspId}"`,
        `"${remainingOrg.domain}"`,
        `"peer0"`,
        `"${remainingOrg.peerPort}"`,
        `"${channel.ordererName}"`,
        `"${channel.ordererPort}"`,
        `"${channel.ordererAdminPort}"`,
      ].join(' ');

      console.log(`[admin] Running full eviction for "${org.name}"...`);
      const { stdout, stderr } = await execAsync(cmd, {
        env: { ...process.env, NETWORK_DIR },
        timeout: 120000,
      });
      if (stdout) console.log(`[removeOrg:stdout] ${stdout}`);
      if (stderr) console.error(`[removeOrg:stderr] ${stderr}`);

      // Mark channel as failed since one org is gone
      await Channel.findByIdAndUpdate(channel._id, { status: 'failed' });
    }

    // Ban in MongoDB
    await Org.findByIdAndUpdate(req.params.id, { fabricStatus: 'banned' });
    console.log(`[admin] Org "${org.name}" fully evicted.`);

    res.json({ message: `Org "${org.name}" fully evicted from network and platform.` });
  } catch (err) {
    console.error('[admin/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/channels ───────────────────────────────────────────────────────
// List ALL channels
router.get('/channels', async (req, res) => {
  try {
    const channels = await Channel.find({})
      .populate('manufacturerOrgId supplierOrgId', 'name mspId type fabricStatus')
      .sort({ createdAt: -1 });
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /admin/channels/:id ────────────────────────────────────────────────
// Remove a channel from platform (MongoDB only)
router.delete('/channels/:id', async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    await Channel.findByIdAndDelete(req.params.id);
    console.log(`[admin] Channel "${channel.channelName}" deleted.`);
    res.json({ message: `Channel "${channel.channelName}" removed from platform.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
