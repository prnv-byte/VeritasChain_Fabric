'use strict';

const express = require('express');
const router  = express.Router();
const { getContract } = require('../fabric/gateway');

const CC_NAME = 'veritasorder';

function decodeResult(result) {
  const raw = Buffer.from(result).toString('utf8');
  try { return JSON.parse(raw); } catch { return raw; }
}

async function withContract(mspId, channel, fn, res) {
  const { gateway, contract } = await getContract(mspId, channel, CC_NAME);
  try {
    return await fn(contract);
  } catch (err) {
    console.error('[requirements withContract error]', err.message, err.details);
    let msg;
    if (err.details && err.details.length) {
      msg = err.details
        .map(d => (typeof d === 'string' ? d : d.message || d.description || JSON.stringify(d)))
        .join('; ');
    } else {
      msg = err.message || String(err);
    }
    res.status(400).json({ error: msg });
    return null;
  } finally {
    gateway.close();
  }
}

// ── POST /requirements ────────────────────────────────────────────────────────
// Called by manufacturer to set or update requirements on a channel.
// Body: { channel, mspId, componentType, globalRequirements, zkRanges, verificationKey }
//   globalRequirements: JSON string — [{name, value, unit}, ...]
//   zkRanges:           JSON string — [{name, min, max, unit}, ...]
//   verificationKey:    string — full content of verification_key.json from snarkjs
router.post('/', async (req, res) => {
  try {
    const { channel, mspId, componentType, globalRequirements, zkRanges, verificationKey } = req.body;

    if (!channel || !mspId || !componentType || !globalRequirements || !zkRanges || !verificationKey) {
      return res.status(400).json({
        error: 'Missing required fields: channel, mspId, componentType, globalRequirements, zkRanges, verificationKey',
      });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction(
        'SetRequirements',
        componentType,
        globalRequirements,
        zkRanges,
        verificationKey,
      );
      return { success: true, message: 'Requirements updated on chain' };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /requirements?channel=<name>&mspId=<id>&manufacturerMSP=<msp> ────────
// Any channel member can call this — supplier reads this to get ranges for proof generation.
router.get('/', async (req, res) => {
  try {
    const { channel, mspId, manufacturerMSP } = req.query;

    if (!channel)        return res.status(400).json({ error: 'Query param ?channel= is required' });
    if (!mspId)          return res.status(400).json({ error: 'Query param ?mspId= is required' });
    if (!manufacturerMSP) return res.status(400).json({ error: 'Query param ?manufacturerMSP= is required' });

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetRequirements', manufacturerMSP);
      return decodeResult(data);
    }, res);

    if (result !== null) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
