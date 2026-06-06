'use strict';

const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  channelName: {
    type: String,
    unique: true,
  },
  manufacturerOrgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Org',
  },
  supplierOrgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Org',
  },
  // Request tracking — both orgs must request to create
  requestedByMfg: {
    type: Boolean,
    default: false,
  },
  requestedBySplr: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['pending', 'provisioning', 'active', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Channel', ChannelSchema);
