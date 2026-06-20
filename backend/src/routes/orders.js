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

async function withContract(mspId, channel, fn, res) {
  const { gateway, contract } = await getContract(mspId, channel, CC_NAME);
  try {
    return await fn(contract);
  } catch (err) {
    console.error('[withContract error]', err.message, err.details);
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

// ── POST /orders ──────────────────────────────────────────────────────────────
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
// Body: { channel, mspId, batchID, zkProof, publicSignals }
// zkProof      = full content of proof.json from snarkjs (as string)
// publicSignals = full content of public.json from snarkjs (as string)
router.post('/:id/fulfill', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId, batchID, zkProof, publicSignals } = req.body;

    if (!channel || !mspId || !batchID || !zkProof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing required fields: channel, mspId, batchID, zkProof, publicSignals',
      });
    }

    const result = await withContract(mspId, channel, async (contract) => {
      await contract.submitTransaction(
        'FulfillOrder', id, batchID, zkProof, publicSignals,
      );
      return { orderID: id, status: 'FULFILLED' };
    }, res);

    if (result) res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orders/:id/run-verify ───────────────────────────────────────────────
// Manufacturer calls this to run snarkjs.groth16.verify against the stored proof.
// Reads proof + publicSignals from chain, reads verificationKey from requirements.
// Body: { channel, mspId, manufacturerMSP }
router.post('/:id/run-verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId, manufacturerMSP } = req.body;

    if (!channel || !mspId || !manufacturerMSP) {
      return res.status(400).json({ error: 'channel, mspId, and manufacturerMSP are required' });
    }

    // Step 1: read order from chain to get proof and public signals
    const order = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrder', id);
      return decodeResult(data);
    }, res);
    if (!order) return;

    if (order.status !== 'FULFILLED') {
      return res.status(400).json({ error: `Order must be FULFILLED to verify, current: ${order.status}` });
    }
    if (!order.zkProof || !order.publicSignals) {
      return res.status(400).json({ error: 'Order is missing zkProof or publicSignals on chain' });
    }

    // Step 2: read requirements from chain to get verification key
    const requirements = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetRequirements', manufacturerMSP);
      return decodeResult(data);
    }, res);
    if (!requirements) return;

    if (!requirements.verificationKey) {
      return res.status(400).json({ error: 'No verification key found in requirements. Manufacturer must set requirements first.' });
    }

    // Step 3: parse the JSON file contents stored on chain
    let proof, publicSignals, vkey;
    try {
      proof         = JSON.parse(order.zkProof);
      publicSignals = JSON.parse(order.publicSignals);
      vkey          = JSON.parse(requirements.verificationKey);
    } catch (parseErr) {
      return res.status(400).json({ error: `Failed to parse proof/signals/vkey JSON: ${parseErr.message}` });
    }

    // Step 4: run snarkjs verification
    // snarkjs is ESM-only in newer versions, use dynamic import
    let isValid;
    try {
      const snarkjs = await import('snarkjs');
      isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    } catch (snarkErr) {
      if (snarkErr.code === 'ERR_MODULE_NOT_FOUND' || snarkErr.message.includes('Cannot find module')) {
        return res.status(500).json({
          error: 'snarkjs is not installed. Run: cd backend && npm install snarkjs',
        });
      }
      return res.status(500).json({ error: `Verification failed: ${snarkErr.message}` });
    }

    res.json({ valid: isValid, orderID: id });
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
