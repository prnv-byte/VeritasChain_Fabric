'use strict';

const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getContract } = require('../fabric/gateway');

const CC_NAME = 'veritasorder';

// ── helpers ───────────────────────────────────────────────────────────────────

function decodeResult(result) {
  const raw = Buffer.from(result).toString('utf8');
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * Helper that opens a gateway, runs fn(contract), then closes the gateway.
 * On chaincode-level errors (GatewayError), returns 400 instead of 500.
 */
async function withContract(mspId, channel, fn, res) {
  const { gateway, contract } = await getContract(mspId, channel, CC_NAME);
  try {
    return await fn(contract);
  } catch (err) {
    console.error('[withContract error]', err.message, err.details);
    const msg = (err.details && err.details.length) ? err.details : (err.message || String(err));
    res.status(400).json({ error: msg });
    return null;
  } finally {
    gateway.close();
  }
}

// ── POST /orders ──────────────────────────────────────────────────────────────
// Body: { manufacturerMSP, supplierMSP, componentType, quantity, specifications,
//         deadline, channel }
router.post('/', async (req, res) => {
  try {
    const { manufacturerMSP, supplierMSP, componentType, quantity,
            specifications, deadline, channel } = req.body;

    if (!manufacturerMSP || !supplierMSP || !componentType || !quantity ||
        !specifications || !deadline || !channel) {
      return res.status(400).json({
        error: 'Missing required fields: manufacturerMSP, supplierMSP, componentType, quantity, specifications, deadline, channel',
      });
    }

    const orderID = `ORDER-${uuidv4()}`;

    // Chaincode: CreateOrder(orderID, quantity, componentType, specifications, supplierMSP, deadline)
    // manufacturerMSP is inferred from the submitter cert inside chaincode
    const result = await withContract(manufacturerMSP, channel, async (contract) => {
      await contract.submitTransaction(
        'CreateOrder',
        orderID,
        String(quantity),
        componentType,
        specifications,
        supplierMSP,
        deadline,
      );
      return { orderID, channel, status: 'PENDING' };
    }, res);

    if (result) res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders?channel=<name>&mspId=<id> ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { channel, mspId } = req.query;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });
    if (!mspId)   return res.status(400).json({ error: 'Query param ?mspId= is required' });

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetAllOrders');
      return decodeResult(data);
    }, res);

    if (result !== null) res.json(result || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders/:id?channel=<name>&mspId=<id> ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId } = req.query;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });
    if (!mspId)   return res.status(400).json({ error: 'Query param ?mspId= is required' });

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrder', id);
      return decodeResult(data);
    }, res);

    if (result !== null) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orders/:id/history?channel=<name>&mspId=<id> ────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId } = req.query;
    if (!channel) return res.status(400).json({ error: 'Query param ?channel= is required' });
    if (!mspId)   return res.status(400).json({ error: 'Query param ?mspId= is required' });

    const result = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrderHistory', id);
      return decodeResult(data);
    }, res);

    if (result !== null) res.json(result || []);
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
    const { channel, mspId, batchID,
            vkURL, pfURL, srhURL, settingsURL,
            vkHash, pfHash, srhHash, settingsHash } = req.body;

    if (!channel || !mspId || !batchID ||
        !vkURL || !pfURL || !srhURL || !settingsURL ||
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
// Body: { channel, mspId }
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId } = req.body;
    if (!channel || !mspId) {
      return res.status(400).json({ error: 'channel and mspId are required' });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction('VerifyAndAccept', id);
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
      return res.status(400).json({ error: 'channel, mspId, and reason are required' });
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
