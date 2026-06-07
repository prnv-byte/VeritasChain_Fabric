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
  // Per-channel dedicated orderer (populated when provisioning starts)
  ordererName:      { type: String },   // full hostname e.g. "orderer-ch-tata-exide.veritaschain.com"
  ordererPort:      { type: Number },   // gRPC port e.g. 8050
  ordererAdminPort: { type: Number },   // admin port e.g. 8053
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Channel', ChannelSchema);
