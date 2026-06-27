'use strict';

const express            = require('express');
const router             = express.Router();
const path               = require('path');
const fs                 = require('fs');
const { spawn }          = require('child_process');
const Channel            = require('../models/Channel');
const ChannelRequirement = require('../models/ChannelRequirement');

const KEYS_DIR     = path.join(__dirname, '..', '..', 'keys', 'channels');
const SETUP_BIN    = process.env.ZK_SETUP_BIN ||
  path.join(__dirname, '..', '..', '..', 'zk', 'dist', 'vc-setup');

function channelKeysDir(channelId) {
  return path.join(KEYS_DIR, channelId.toString());
}

// ── Run vc-setup in the background after requirements are saved ───────────────
// ranges: [{name, min, max}] — optional; if provided, passed to vc-setup for range enforcement
function runSetup(channelId, paramNames, batchRows, ranges) {
  const outDir = channelKeysDir(channelId);
  fs.mkdirSync(outDir, { recursive: true });

  const args = [
    '--params', paramNames.join(','),
    '--rows',   String(batchRows),
    '--out',    outDir,
  ];

  // Pass min/max per param when available
  if (ranges && ranges.length) {
    const mins = paramNames.map(n => { const r = ranges.find(x => x.name === n); return r?.min ?? ''; });
    const maxs = paramNames.map(n => { const r = ranges.find(x => x.name === n); return r?.max ?? ''; });
    if (mins.some(v => v !== '')) args.push('--mins', mins.join(','));
    if (maxs.some(v => v !== '')) args.push('--maxs', maxs.join(','));
  }

  console.log(`[zk-setup] Starting for channel ${channelId}: params=${paramNames.join(',')} rows=${batchRows}`);
  console.log(`[zk-setup] Command: ${SETUP_BIN} ${args.join(' ')}`);

  // detached so nodemon restarts don't kill the long-running setup process
  const child = spawn(SETUP_BIN, args, {
    detached: true,
    stdio:    ['ignore', 'pipe', 'pipe'],
  });
  // NOTE: do NOT call child.unref() — we need the event loop to stay alive
  // for the close/error handlers. detached=true is enough to survive nodemon restarts.

  console.log(`[zk-setup] PID ${child.pid} — this takes 2-5 minutes, please wait...`);

  // Log stdout and stderr in real time so backend console shows progress
  child.stdout.on('data', d => process.stdout.write(`[zk-setup:out] ${d}`));
  child.stderr.on('data', d => process.stdout.write(`[zk-setup:err] ${d}`));

  // Heartbeat every 30s so logs show it's still alive
  const heartbeat = setInterval(() => {
    console.log(`[zk-setup] Still running for channel ${channelId} (PID ${child.pid})...`);
  }, 30_000);

  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });

  child.on('error', async (err) => {
    clearInterval(heartbeat);
    const msg = `Failed to start vc-setup: ${err.message}`;
    console.error(`[zk-setup] ERROR for channel ${channelId}:`, msg);
    await ChannelRequirement.findOneAndUpdate(
      { channelId },
      { zkeyStatus: 'failed', zkeyError: msg.slice(0, 500) }
    );
  });

  child.on('close', async (code) => {
    clearInterval(heartbeat);

    if (code !== 0) {
      const msg = stderr.trim() || `vc-setup exited with code ${code}`;
      console.error(`[zk-setup] FAILED for channel ${channelId} (code ${code}):`, msg);
      await ChannelRequirement.findOneAndUpdate(
        { channelId },
        { zkeyStatus: 'failed', zkeyError: msg.slice(0, 500) }
      );
      return;
    }

    const pkPath = path.join(outDir, 'circuit.pk');
    const vkPath = path.join(outDir, 'circuit.vk');

    if (!fs.existsSync(pkPath) || !fs.existsSync(vkPath)) {
      const msg = 'vc-setup completed but output files are missing';
      console.error(`[zk-setup] ${msg} for channel ${channelId}`);
      await ChannelRequirement.findOneAndUpdate(
        { channelId },
        { zkeyStatus: 'failed', zkeyError: msg }
      );
      return;
    }

    console.log(`[zk-setup] ✓ DONE for channel ${channelId}. Keys ready at ${outDir}`);
    await ChannelRequirement.findOneAndUpdate(
      { channelId },
      { zkeyStatus: 'ready', zkeyError: null, pkPath, vkPath }
    );
  });
}

// ── GET /channel-reqs?channelId=xxx ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) return res.status(400).json({ error: 'channelId query param required' });
    const reqs = await ChannelRequirement.findOne({ channelId });
    res.json(reqs || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /channel-reqs ────────────────────────────────────────────────────────
// Body: { channelId, params: [{name, value, unit}], batchRows }
// Saves requirements, then triggers vc-setup in background.
router.post('/', async (req, res) => {
  try {
    const { channelId, params, batchRows } = req.body;
    if (!channelId)             return res.status(400).json({ error: 'channelId is required' });
    if (!Array.isArray(params)) return res.status(400).json({ error: 'params must be an array' });

    const channel = await Channel.findById(channelId).populate('manufacturerOrgId', 'mspId');
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const validParams = params.filter(p => p.name?.trim());
    if (validParams.length === 0) return res.status(400).json({ error: 'At least one parameter required' });

    const rows = Math.max(1, parseInt(batchRows) || 100);

    // Param names for ZK circuit — lowercase, no spaces
    const paramNames = validParams.map(p => p.name.trim().toLowerCase().replace(/\s+/g, '_'));

    // Ranges aligned to normalised param names
    const ranges = validParams.map((p, i) => ({
      name: paramNames[i],
      min:  p.min ?? '',
      max:  p.max ?? '',
    }));

    const reqs = await ChannelRequirement.findOneAndUpdate(
      { channelId },
      {
        channelId,
        channelName:       channel.channelName,
        manufacturerMspId: channel.manufacturerOrgId.mspId,
        params:            validParams,
        batchRows:         rows,
        zkeyStatus:        'generating',
        zkeyError:         null,
        pkPath:            null,
        vkPath:            null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Fire vc-setup in background — do not await
    runSetup(channelId, paramNames, rows, ranges);

    res.json(reqs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /channel-reqs/pk?channelId=xxx ───────────────────────────────────────
// Supplier downloads the proving key file.
router.get('/pk', async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) return res.status(400).json({ error: 'channelId is required' });

    const reqs = await ChannelRequirement.findOne({ channelId });
    if (!reqs)                          return res.status(404).json({ error: 'Requirements not found' });
    if (reqs.zkeyStatus !== 'ready')    return res.status(400).json({ error: `Keys are not ready yet (status: ${reqs.zkeyStatus})` });
    if (!reqs.pkPath || !fs.existsSync(reqs.pkPath)) {
      return res.status(404).json({ error: 'Proving key file not found on server' });
    }

    res.download(reqs.pkPath, 'circuit.pk');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Called by index.js startup healer to re-run setup for a stuck ChannelRequirement doc
async function runSetupForReq(req) {
  const paramNames = req.params.map(p => p.name.trim().toLowerCase().replace(/\s+/g, '_'));
  const ranges     = req.params.map((p, i) => ({ name: paramNames[i], min: p.min ?? '', max: p.max ?? '' }));
  runSetup(req.channelId.toString(), paramNames, req.batchRows || 100, ranges);
}

module.exports = router;
module.exports.runSetupForReq = runSetupForReq;
