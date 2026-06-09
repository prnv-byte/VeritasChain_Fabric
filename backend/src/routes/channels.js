'use strict';

const express  = require('express');
const router   = express.Router();
const Org      = require('../models/Org');
const Channel  = require('../models/Channel');
const { toChannelName, createChannel } = require('../fabric/provisioner');

// ── POST /channels/request ───────────────────────────────────────────────────
// Body: { fromOrgId, toOrgId }
// The requesting org "sends" a channel request to the target org.
// When BOTH orgs have requested → channel is automatically created.
router.post('/request', async (req, res) => {
  try {
    const { fromOrgId, toOrgId } = req.body;
    if (!fromOrgId || !toOrgId) {
      return res.status(400).json({ error: 'fromOrgId and toOrgId are required' });
    }
    if (fromOrgId === toOrgId) {
      return res.status(400).json({ error: 'Cannot request a channel with yourself' });
    }

    const fromOrg = await Org.findById(fromOrgId);
    const toOrg   = await Org.findById(toOrgId);
    if (!fromOrg || !toOrg) {
      return res.status(404).json({ error: 'One or both orgs not found' });
    }
    if (fromOrg.fabricStatus !== 'active' || toOrg.fabricStatus !== 'active') {
      return res.status(400).json({
        error: 'Both orgs must be fully provisioned (fabricStatus: "active") before creating a channel',
      });
    }

    // Any org type can channel with any other — requester is always "mfg" slot (order creator)
    // Find existing channel in either direction
    let channel = await Channel.findOne({
      $or: [
        { manufacturerOrgId: fromOrg._id, supplierOrgId: toOrg._id },
        { manufacturerOrgId: toOrg._id,   supplierOrgId: fromOrg._id },
      ],
    });

    if (!channel) {
      // Assign slots based on org type, not who requested first
      const mfgOrg  = fromOrg.type === 'manufacturer' ? fromOrg : toOrg;
      const splrOrg = fromOrg.type === 'manufacturer' ? toOrg   : fromOrg;
      const channelName = toChannelName(mfgOrg, splrOrg);
      channel = await Channel.create({
        channelName,
        manufacturerOrgId: mfgOrg._id,
        supplierOrgId:     splrOrg._id,
        requestedByMfg:  fromOrg.type === 'manufacturer',
        requestedBySplr: fromOrg.type === 'supplier',
        status: 'pending',
      });
    } else {
      // Second request — mark based on org type
      const fromIsMfg = fromOrg.type === 'manufacturer';
      if (fromIsMfg) channel.requestedByMfg  = true;
      else           channel.requestedBySplr = true;
      await channel.save();
    }

    // If both sides have requested AND channel is pending or failed → provision it
    if (channel.requestedByMfg && channel.requestedBySplr && (channel.status === 'pending' || channel.status === 'failed')) {
      channel.status = 'provisioning';
      await channel.save();

      // Fetch the two orgs from the channel record (works for both first-time and retry)
      const [channelMfgOrg, channelSplrOrg] = await Promise.all([
        Org.findById(channel.manufacturerOrgId),
        Org.findById(channel.supplierOrgId),
      ]);

      // Fire-and-forget channel creation (pass channel._id so provisioner can save orderer info)
      createChannel(channel.channelName, channelMfgOrg.toObject(), channelSplrOrg.toObject(), channel._id)
        .then(() => Channel.findByIdAndUpdate(channel._id, { status: 'active' }))
        .catch(err => {
          console.error(`[channels] Channel creation failed for "${channel.channelName}":`, err.message);
          Channel.findByIdAndUpdate(channel._id, { status: 'failed' }).catch(() => {});
        });

      return res.json({
        message: 'Both orgs have accepted — channel is being created in the background.',
        channel,
      });
    }

    res.json({
      message: 'Channel request recorded. Waiting for the other org to accept.',
      channel,
    });
  } catch (err) {
    console.error('[channels/request]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /channels?orgId=xxx ──────────────────────────────────────────────────
// List all channels where the org is either manufacturer or supplier
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId query param required' });

    const channels = await Channel.find({
      $or: [
        { manufacturerOrgId: orgId },
        { supplierOrgId:     orgId },
      ],
    }).populate('manufacturerOrgId supplierOrgId', 'name mspId type domain peerPort');

    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /channels/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate('manufacturerOrgId supplierOrgId', 'name mspId type domain peerPort');
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
