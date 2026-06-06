'use strict';

const mongoose = require('mongoose');

const OrgSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['manufacturer', 'supplier'],
    required: true,
  },
  whatTheyMake: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  contact: {
    type: String,
    required: true,
    trim: true,
  },
  // Fabric identity fields — set during provisioning
  mspId: {
    type: String,
    unique: true,
    sparse: true,
  },
  domain: {
    type: String,
    unique: true,
    sparse: true,
  },
  caPort: {
    type: Number,
  },
  peerPort: {
    type: Number,
  },
  ccPort: {
    type: Number,
  },
  peerName: {
    type: String,
    default: 'peer0',
  },
  fabricStatus: {
    type: String,
    enum: ['pending', 'provisioning', 'active', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Org', OrgSchema);
