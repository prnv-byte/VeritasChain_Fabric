'use strict';

const mongoose = require('mongoose');

const ParamSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true },
    value: { type: String, default: '' },
    unit:  { type: String, default: '' },
    min:   { type: String, default: '' },
    max:   { type: String, default: '' },
  },
  { _id: false }
);

const ChannelRequirementSchema = new mongoose.Schema({
  channelId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, unique: true },
  channelName:       { type: String, required: true },
  manufacturerMspId: { type: String, required: true },
  params:            { type: [ParamSchema], default: [] },
  batchRows:         { type: Number, default: 100 },  // number of CSV rows supplier must prove

  // ZK key generation state
  zkeyStatus: { type: String, enum: ['none', 'generating', 'ready', 'failed'], default: 'none' },
  zkeyError:  { type: String, default: null },
  pkPath:     { type: String, default: null },  // absolute path to circuit.pk on server
  vkPath:     { type: String, default: null },  // absolute path to circuit.vk on server
}, { timestamps: true });

module.exports = mongoose.model('ChannelRequirement', ChannelRequirementSchema);
