'use strict';

const express      = require('express');
const router       = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');
const os           = require('os');
const { execFile } = require('child_process');
const { getContract } = require('../fabric/gateway');
const ChannelRequirement = require('../models/ChannelRequirement');
const Channel            = require('../models/Channel');

// ── file upload (memory storage — we persist to disk manually after validation) ──
const upload = multer({ storage: multer.memoryStorage() });

const PROOFS_DIR = path.join(__dirname, '..', '..', 'proofs');

function proofDir(channelName, orderId) {
  return path.join(PROOFS_DIR, channelName, orderId);
}


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
// Multipart form: proofFile (.proof binary), publicFile (.public.json)
// Form fields:   channel, mspId, batchID (optional)
//
// Proof binary is base64-encoded and stored on-chain as zkProof.
// public.json content is stored on-chain as publicSignals (transparency).
// vk is NOT uploaded by supplier — it is looked up from the channel's vc-setup output.
router.post('/:id/fulfill',
  upload.fields([
    { name: 'proofFile',  maxCount: 1 },
    { name: 'publicFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { channel, mspId, batchID } = req.body;

      if (!channel || !mspId) {
        return res.status(400).json({ error: 'channel and mspId are required' });
      }

      const proofBuf  = req.files?.proofFile?.[0]?.buffer;
      const publicBuf = req.files?.publicFile?.[0]?.buffer;

      if (!proofBuf || !publicBuf) {
        return res.status(400).json({
          error: 'Two files are required: proofFile (.proof) and publicFile (.public.json)',
        });
      }

      // Validate public.json is parseable
      const publicStr = publicBuf.toString('utf8');
      try { JSON.parse(publicStr); } catch {
        return res.status(400).json({ error: 'publicFile is not valid JSON' });
      }

      // zkProof = base64-encoded gnark proof binary
      const zkProof = proofBuf.toString('base64');
      const resolvedBatchID = batchID || `BATCH-${Date.now()}`;

      const result = await withContract(mspId, channel, async (contract) => {
        await contract.submitTransaction(
          'FulfillOrder', id, resolvedBatchID, zkProof, publicStr,
        );
        return { orderID: id, status: 'FULFILLED' };
      }, res);

      if (result) {
        // Persist proof files to backend/proofs/<channelName>/<orderId>/
        const dir = proofDir(channel, id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'proof.proof'),  proofBuf);
        fs.writeFileSync(path.join(dir, 'public.json'),  publicStr, 'utf8');
        console.log(`[fulfill] Proof files saved to ${dir}`);
        res.json(result);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /orders/:id/run-verify ───────────────────────────────────────────────
// OEM calls this to verify the supplier's gnark proof using vc-quickverify.
// Reads proof (base64) + publicSignals (JSON string) from chain.
// Reads vk binary from server filesystem (saved during fulfill).
// Body: { channel, mspId }
router.post('/:id/run-verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, mspId } = req.body;

    if (!channel || !mspId) {
      return res.status(400).json({ error: 'channel and mspId are required' });
    }

    // Step 1: fetch order from chain
    const order = await withContract(mspId, channel, async (contract) => {
      const data = await contract.evaluateTransaction('GetOrder', id);
      return decodeResult(data);
    }, res);
    if (!order) return;

    if (order.status !== 'FULFILLED') {
      return res.status(400).json({ error: `Order must be FULFILLED to verify, current: ${order.status}` });
    }
    if (!order.zkProof || !order.publicSignals) {
      return res.status(400).json({ error: 'Order is missing proof data on chain' });
    }

    // Step 2: look up vk from channel requirements (written by vc-setup when OEM saved requirements)
    const channelDoc = await Channel.findOne({ channelName: channel });
    const reqs = channelDoc
      ? await ChannelRequirement.findOne({ channelId: channelDoc._id })
      : null;
    const vk = reqs?.vkPath;
    if (!vk || !fs.existsSync(vk)) {
      return res.status(400).json({
        error: 'Verifying key not found. Make sure the OEM has saved requirements and ZK keys are generated (status: ready).',
      });
    }

    // Step 3: write temp files for vc-quickverify
    const tmpProof  = path.join(os.tmpdir(), `${id}.proof`);
    const tmpPublic = path.join(os.tmpdir(), `${id}.public.json`);
    try {
      fs.writeFileSync(tmpProof,  Buffer.from(order.zkProof, 'base64'));
      fs.writeFileSync(tmpPublic, order.publicSignals);
    } catch (writeErr) {
      return res.status(500).json({ error: `Failed to prepare temp files: ${writeErr.message}` });
    }

    // Step 4: run vc-quickverify subprocess
    const verifierBin = process.env.ZK_VERIFIER_BIN ||
      path.join(__dirname, '..', '..', '..', 'zk', 'dist', 'vc-quickverify');

    try {
      const { valid, output } = await new Promise((resolve, reject) => {
        execFile(
          verifierBin,
          ['--proof', tmpProof, '--public', tmpPublic, '--vk', vk],
          { timeout: 30_000 },
          (err, stdout, stderr) => {
            if (err && err.code === 2) {
              // exit 2 = PROOF INVALID — not an operational error
              resolve({ valid: false, output: stdout || 'PROOF INVALID' });
            } else if (err) {
              reject(new Error(
                err.code === 'ENOENT'
                  ? `vc-quickverify binary not found at ${verifierBin}. Build it with: cd zk && go build -o dist/vc-quickverify ./cmd/verifier/`
                  : (stderr || err.message)
              ));
            } else {
              resolve({ valid: true, output: stdout });
            }
          }
        );
      });

      if (valid && reqs?.params?.length) {
        // Application-layer range check: compare proof's public stats against OEM requirements.
        // The ZK circuit only proves "stats are internally consistent" — it does NOT prove
        // that the batch min/max fall within the OEM's specified allowed range.
        // We must do that check here using the public signals from the chain.
        let publicSignals;
        try { publicSignals = JSON.parse(order.publicSignals); } catch { publicSignals = null; }

        if (publicSignals?.parameters) {
          const violations = [];
          for (const param of reqs.params) {
            const colKey = param.name.trim().toLowerCase().replace(/\s+/g, '_');
            const colStats = publicSignals.parameters[colKey] || publicSignals.parameters[param.name];
            if (!colStats) continue;

            const actualMin = colStats.min;
            const actualMax = colStats.max;
            const reqMin = param.min != null && param.min !== '' ? Number(param.min) : null;
            const reqMax = param.max != null && param.max !== '' ? Number(param.max) : null;

            if (reqMin !== null && actualMin < reqMin) {
              violations.push(`${param.name}: batch min ${actualMin} < required min ${reqMin}`);
            }
            if (reqMax !== null && actualMax > reqMax) {
              violations.push(`${param.name}: batch max ${actualMax} > required max ${reqMax}`);
            }
          }

          if (violations.length) {
            return res.json({
              valid: false,
              output: `PROOF VALID but batch is OUT OF SPEC:\n${violations.join('\n')}`,
              violations,
              orderID: id,
            });
          }
        }
      }

      res.json({ valid, output, orderID: id });
    } finally {
      try { fs.unlinkSync(tmpProof);  } catch {}
      try { fs.unlinkSync(tmpPublic); } catch {}
    }
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
