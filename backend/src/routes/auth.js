'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const Org     = require('../models/Org');

const router = express.Router();

router.post('/password-setup', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password || password.length < 8) {
      return res.status(400).json({ error: 'Token and password are required. Password must be at least 8 characters.' });
    }

    const org = await Org.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!org) {
      return res.status(400).json({ error: 'Password setup token is invalid or expired.' });
    }

    org.passwordHash = await bcrypt.hash(password, 10);
    org.passwordResetToken = undefined;
    org.passwordResetExpires = undefined;
    await org.save();

    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
