'use strict';

const express = require('express');
const router  = express.Router();
const Org     = require('../models/Org');
const { toMspId, toDomain, toFolderName, provisionOrg } = require('../fabric/provisioner');
const { assignCaPort, assignPeerPort } = require('../fabric/portManager');

// ── POST /orgs/register ───────────────────────────────────────────────────────
// Body: { name, type, whatTheyMake, address, contact }
router.post('/register', async (req, res) => {
  try {
    const { name, type, whatTheyMake, address, contact } = req.body;

    // Validate required fields
    if (!name || !type || !whatTheyMake || !address || !contact) {
      return res.status(400).json({
        error: 'All fields required: name, type, whatTheyMake, address, contact',
      });
    }
    if (!['manufacturer', 'supplier'].includes(type)) {
      return res.status(400).json({ error: 'type must be "manufacturer" or "supplier"' });
    }

    // Org name must produce a valid Fabric identifier (at least 3 alphanumeric chars after stripping)
    const cleanName = name.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (cleanName.length < 3) {
      return res.status(400).json({
        error: 'Organization name must contain at least 3 letters or digits (e.g. "Tata Motors", not "A.B.")',
      });
    }

    // Check name uniqueness
    const existing = await Org.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: 'Organization name already registered' });
    }

    // Derive Fabric identity fields
    const mspId    = toMspId(name.trim());
    const domain   = toDomain(name.trim());
    const caPort   = await assignCaPort();
    const peerPort = await assignPeerPort();
    const ccPort   = peerPort + 1;
    const peerName = 'peer0';

    // Persist to DB first (with fabricStatus: provisioning)
    const org = await Org.create({
      name: name.trim(),
      type,
      whatTheyMake,
      address,
      contact,
      mspId,
      domain,
      caPort,
      peerPort,
      ccPort,
      peerName,
      fabricStatus: 'provisioning',
    });

    // Provision Fabric identity asynchronously — don't block the HTTP response
    provisionOrg({ name: org.name, mspId, domain, caPort, peerPort, ccPort, peerName })
      .then(() => Org.findByIdAndUpdate(org._id, { fabricStatus: 'active' }))
      .catch(err => {
        console.error(`[orgs] Provisioning failed for "${org.name}":`, err.message);
        Org.findByIdAndUpdate(org._id, { fabricStatus: 'failed' }).catch(() => {});
      });

    res.status(201).json({
      id:          org._id,
      name:        org.name,
      type:        org.type,
      mspId:       org.mspId,
      domain:      org.domain,
      caPort:      org.caPort,
      peerPort:    org.peerPort,
      fabricStatus: 'provisioning',
      message: 'Registration submitted. Fabric identity is being provisioned in the background.',
    });
  } catch (err) {
    console.error('[orgs/register]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs ─────────────────────────────────────────────────────────────────
// List orgs — supports ?type=manufacturer|supplier and ?search=<name>
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = {};

    // By default show all orgs; callers can filter to active only by passing ?status=active
    if (req.query.status) filter.fabricStatus = req.query.status;
    if (type) filter.type = type;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const orgs = await Org.find(filter).select('-__v').sort({ createdAt: -1 });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs/by-msp/:mspId ───────────────────────────────────────────────────
router.get('/by-msp/:mspId', async (req, res) => {
  try {
    const org = await Org.findOne({ mspId: req.params.mspId }).select('-__v');
    if (!org) return res.status(404).json({ error: 'Org not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs/:id ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const org = await Org.findById(req.params.id).select('-__v');
    if (!org) return res.status(404).json({ error: 'Org not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
