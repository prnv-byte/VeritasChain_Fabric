'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getContract } = require('../fabric/gateway');
const { channelForComponent } = require('../config/network');

const CC_NAME = 'veritasorder';

// ── helpers ───────────────────────────────────────────────────────────────────

function decodeResult(result) {
  const raw = Buffer.from(result).toString('utf8');
  try { return JSON.parse(raw); } catch { return raw; }
}

async function withContract(mspId, channel, fn, res) {
  const { gateway, contract } = await getContract(mspId, channel, CC_NAME);
  try {
    return await fn(contract);
  } catch (err) {
    const msg = err.details || err.message || String(err);
    res.status(400).json({ error: msg });
    return null;
  } finally {
    gateway.close();
  }
}

// ── POST /orders ───────────────────────────────────────────────────────────────
// Body: { manufacturerMSP, supplierMSP, componentType, quantity, specifications, deadline }
router.post('/', async (req, res) => {
  try {
    const { manufacturerMSP, supplierMSP, componentType, quantity, specifications, deadline } = req.body;
    if (!manufacturerMSP || !supplierMSP || !componentType || !quantity || !specifications || !deadline) {
      return res.status(400).json({ error: 'Missing required fields: manufacturerMSP, supplierMSP, componentType, quantity, specifications, deadline' });
    }

    const orderID = `ORDER-${uuidv4()}`;
    const channel = channelForComponent(componentType);

    const result = await withContract(manufacturerMSP, channel, async (contract) => {
      await contract.submitTransaction(
        'CreateOrder',
        orderID,
        manufacturerMSP,
        supplierMSP,
        componentType,
        String(quantity),
        specifications,
        deadline,
      );
      return { orderID, channel, status: 'PENDING' };
    }, res);

    if (result) res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders/:id?channel=voltride-battery ──────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });

    const mspId = req.query.mspId || process.env.ORG_MSP_ID || 'VoltRideMSP';

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrder', id);
      return decodeResult(data);
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders?channel=voltride-battery&mspId=BatteryMSP ────────────────────
router.get('/', async (req, res) => {
  try {
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });

    const mspId = req.query.mspId || process.env.ORG_MSP_ID || 'VoltRideMSP';

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetAllOrders');
      return decodeResult(data);
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders/by-supplier/:supplierMSP?channel= ────────────────────────────
router.get('/by-supplier/:supplierMSP', async (req, res) => {
  try {
    const { supplierMSP } = req.params;
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });

    const mspId = req.query.mspId || process.env.ORG_MSP_ID || 'VoltRideMSP';

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrdersBySupplier', supplierMSP);
      return decodeResult(data);
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders/by-manufacturer/:manufacturerMSP?channel= ────────────────────
router.get('/by-manufacturer/:manufacturerMSP', async (req, res) => {
  try {
    const { manufacturerMSP } = req.params;
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });

    const mspId = req.query.mspId || process.env.ORG_MSP_ID || 'VoltRideMSP';

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrdersByManufacturer', manufacturerMSP);
      return decodeResult(data);
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders/:id/history?channel= ─────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });

    const mspId = req.query.mspId || process.env.ORG_MSP_ID || 'VoltRideMSP';

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrderHistory', id);
      return decodeResult(data);
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orders/:id/fulfill ──────────────────────────────────────────────────
// Body: { channel, mspId, batchID, vkURL, pfURL, srhURL, settingsURL,
//         vkHash, pfHash, srhHash, settingsHash }
router.post('/:id/fulfill', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId, batchID, vkURL, pfURL, srhURL, settingsURL,
            vkHash, pfHash, srhHash, settingsHash } = req.body;

    if (!channel || !mspId || !batchID || !vkURL || !pfURL || !srhURL || !settingsURL ||
        !vkHash || !pfHash || !srhHash || !settingsHash) {
      return res.status(400).json({ error: 'Missing required fields for fulfill' });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction(
        'FulfillOrder', id, batchID,
        vkURL, pfURL, srhURL, settingsURL,
        vkHash, pfHash, srhHash, settingsHash,
      );
      return { orderID: id, status: 'FULFILLED' };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orders/:id/verify ───────────────────────────────────────────────────
// Body: { channel, mspId, verificationResult, verifiedBy }
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId, verificationResult, verifiedBy } = req.body;

    if (!channel || !mspId || !verificationResult || !verifiedBy) {
      return res.status(400).json({ error: 'Missing required fields for verify' });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction('VerifyAndAccept', id, verificationResult, verifiedBy);
      return { orderID: id, status: 'ACCEPTED' };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orders/:id/reject ───────────────────────────────────────────────────
// Body: { channel, mspId, reason }
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId, reason } = req.body;

    if (!channel || !mspId || !reason) {
      return res.status(400).json({ error: 'Missing required fields for reject' });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction('RejectOrder', id, reason);
      return { orderID: id, status: 'REJECTED' };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orders/:id/cancel ───────────────────────────────────────────────────
// Body: { channel, mspId }
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId } = req.body;

    if (!channel || !mspId) {
      return res.status(400).json({ error: 'channel and mspId are required' });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction('CancelOrder', id);
      return { orderID: id, status: 'CANCELLED' };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orders/:id/feedback ─────────────────────────────────────────────────
// Body: { channel, mspId, feedbackText }
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId, feedbackText } = req.body;

    if (!channel || !mspId || !feedbackText) {
      return res.status(400).json({ error: 'channel, mspId, and feedbackText are required' });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction('SubmitFeedback', id, feedbackText);
      return { orderID: id, feedbackRecorded: true };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
