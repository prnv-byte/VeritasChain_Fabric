'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto'); // Built-in Node.js module
const Org     = require('../models/Org');
const { toMspId, toDomain, toFolderName, provisionOrg } = require('../fabric/provisioner');
const { assignCaPort, assignPeerPort } = require('../fabric/portManager');
const { sendPasswordSetupEmail } = require('../utils/mailer');

// ── POST /orgs/register ───────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, type, whatTheyMake, address, contact, email } = req.body;

    // Validate required fields
    if (!name || !type || !whatTheyMake || !address || !contact || !email) {
      return res.status(400).json({
        error: 'All fields required: name, type, whatTheyMake, address, contact, email',
      });
    }
    if (!['manufacturer', 'supplier'].includes(type)) {
      return res.status(400).json({ error: 'type must be "manufacturer" or "supplier"' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const existingEmail = await Org.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    // Produce a baseline safe alphanumeric string for Fabric paths
    const cleanBaseName = name.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanBaseName.length < 3) {
      return res.status(400).json({
        error: 'Organization name must contain at least 3 letters or digits.',
      });
    }

    // Default slug matches the cleaned name.
    let slug = cleanBaseName;

    // Ensure slug uniqueness for repeated business names.
    while (await Org.findOne({ slug })) {
      const randomSuffix = crypto.randomBytes(2).toString('hex'); // e.g., "8f3a"
      slug = `${cleanBaseName}-${randomSuffix}`;
    }

    // Allocate unique numeric port numbers asynchronously
    const caPort = await assignCaPort();
    const peerPort = await assignPeerPort();
    const ccPort = peerPort + 1;
    const peerName = 'peer0';

    // Downstream generation parameters are completely unique to this specific slug
    const mspId      = toMspId(slug);      
    const domain     = toDomain(slug);     
    const folderName = toFolderName(slug); 

    // Save metadata structure into database
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const org = new Org({
      name: name.trim(), // Stored display name (Duplicates permitted)
      slug,              // Isolated routing slug (e.g. "tatamotors-a2b1")
      type,
      whatTheyMake,
      address,
      contact,
      email: normalizedEmail,
      passwordResetToken,
      passwordResetExpires,
      caPort,
      peerPort,
      ccPort,
      peerName,
      mspId,
      domain,
      folderName,
      fabricStatus: 'registering',
    });

    await org.save();

    try {
      await sendPasswordSetupEmail(org, passwordResetToken);
    } catch (err) {
      console.error('[email] Failed to send password setup email for', normalizedEmail, err);
      org.fabricStatus = 'failed';
      await org.save();
      return res.status(500).json({ error: 'Failed to send password setup email. Please contact support.' });
    }

    // Provision the org using a plain JS object so downstream code gets exact fields.
    const orgPayload = org.toObject();
    provisionOrg(orgPayload)
      .then(async () => {
        org.fabricStatus = 'active';
        await org.save();
        console.log(`[Fabric] Org ${slug} successfully active.`);
      })
      .catch(async (err) => {
        console.error(`[Fabric] Provisioning failed for ${slug}:`, err);
        org.fabricStatus = 'failed';
        await org.save();
      });

    res.status(202).json({
      message: 'Registration initiated successfully.',
      orgId: org._id,
      name: org.name,
      email: org.email,
      mspId: org.mspId,
      slug: org.slug,
      fabricStatus: org.fabricStatus,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = {};

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