# Phase 3 Changes — Feature Summary for Pranav

## Overview
Three major features added on top of the existing Phase 2 codebase:
1. Channel Accept / Decline UI
2. Role-based order creation (manufacturer slot only)
3. Requirements system with sidebar navigation

---

## Backend Changes

### 1. New file: `backend/src/models/ChannelRequirement.js`
New MongoDB model for storing channel requirements (off-chain, Phase 3).
Fields: `channelId`, `channelName`, `manufacturerMspId`, `params: [{name, value, unit}]`
One document per channel (upsert pattern — save overwrites existing).

### 2. New file: `backend/src/routes/channelReqs.js`
Two endpoints mounted at `/channel-reqs`:
- `GET /channel-reqs?channelId=xxx` — fetch requirements for a channel
- `POST /channel-reqs` — create or overwrite requirements for a channel
  Body: `{ channelId, params: [{name, value, unit}] }`

### 3. Modified: `backend/src/models/Channel.js`
Added `'declined'` to the `status` enum.
Before: `['pending', 'provisioning', 'active', 'failed']`
After:  `['pending', 'provisioning', 'active', 'failed', 'declined']`

### 4. Modified: `backend/src/routes/channels.js`
Added new endpoint: `POST /channels/:id/decline`
Sets a pending channel's status to `'declined'`. Returns 400 if channel is not pending.

### 5. Modified: `backend/src/index.js`
Mounted the new route: `app.use('/channel-reqs', require('./routes/channelReqs'));`

---

## Frontend Changes

### 6. Modified: `frontend/src/services/api.js`
Added two new service objects:

```js
channelService.declineChannel(id)         // POST /channels/:id/decline
channelReqsService.get(channelId)         // GET  /channel-reqs?channelId=
channelReqsService.save(channelId, params) // POST /channel-reqs
```

### 7. Modified: `frontend/src/components/Layout.jsx`
Added a **persistent sidebar navigation** (always visible on every page):
- Dashboard · Channels · Requirements · Orders
- Uses `NavLink` from react-router-dom so the active page is highlighted.
- Nav icons from `lucide-react`.

### 8. Modified: `frontend/src/styles/layout.css`
Added CSS for `.sidebar-nav`, `.sidebar-nav-link`, `.sidebar-nav-link:hover`, `.sidebar-nav-link.active`.
Active state: indigo left-border highlight.

### 9. Rewritten: `frontend/src/pages/DashboardNew.jsx`
Key changes:
- **Incoming Requests section**: appears at the top of the dashboard when another org has sent a channel request. Shows the requester's name, type, and Accept / Decline buttons.
- **Accept logic**: calls `channelService.requestChannel(myId, otherOrgId)` — this is the second handshake that triggers provisioning.
- **Decline logic**: calls `channelService.declineChannel(channelId)`.
- **Org cards updated**: "Connect" button now shows `⏳ Pending` (disabled) if you have already sent a request to that org, so you know it's awaiting the other side.
- **Infinite loop fix**: `useEffect` dep array changed from `[navigate, error]` to `[]`.

### 10. Rewritten: `frontend/src/pages/ChannelsPage.jsx`
Key changes:
- **Accept / Decline buttons** per channel card when there is a pending incoming request.
- Shows each channel's **role** ("Your role: Manufacturer / Supplier") and partner name.
- Pending outgoing channels show "Waiting for X to accept…"
- "Requirements" button only shown for channels where you are the manufacturer.
- **Infinite loop fix**: `useEffect` dep array changed from `[navigate, error]` to `[]`.

### 11. Rewritten: `frontend/src/pages/RequirementsPage.jsx`
Completely rewritten to use the new MongoDB-backed requirements (no Fabric dependency):
- **No channels**: Shows "No requirements have been created so far" with a link to find partners.
- **Manufacturer view**: Editable table with Add Row / Delete Row. Columns: Parameter Name, Value, SI Unit. Save button calls `channelReqsService.save()`.
- **Supplier view**: Read-only table showing the manufacturer's requirements. Shows a warning if the manufacturer hasn't set them yet.
- Channel selector on the left panel shows the user's role per channel.

### 12. Rewritten: `frontend/src/pages/OrderCreateNew.jsx`
Key changes:
- **Manufacturer-only channels**: Channel list is filtered to only channels where `channel.manufacturerOrgId._id === user.id`. Suppliers cannot create orders in channels where they are in the supplier slot.
- **Requirements gate**: Before submitting an order, checks `channelReqsService.get(channelId)`. If no requirements exist, shows an error toast and blocks submission.
- **Supplier auto-fill**: Since only manufacturer channels are shown, the supplier is always `channel.supplierOrgId` — no ambiguous dropdown.
- **Infinite loop fix**: `useEffect` dep array changed from `[navigate, error]` to `[]`.

---

## Role Logic Summary

The backend already correctly assigns `manufacturerOrgId` / `supplierOrgId` slots:
- **Manufacturer vs Supplier** (different types): real manufacturer always gets the mfg slot.
- **Same type** (mfg↔mfg or supplier↔supplier): **whoever sends the request first** gets the manufacturer slot. The other org is treated as supplier for order/requirements purposes, regardless of their registered type.

This means:
- The org in `manufacturerOrgId` can: create orders, set requirements.
- The org in `supplierOrgId` can: view requirements, fulfill orders, submit ZK proofs.

---

## What is NOT changed (Phase 4 scope)
- The chain-based requirements (`POST /requirements`, `GET /requirements`) — still exists for ZK proof integration later.
- `RequirementsPanel.jsx` — still exists but is no longer used by the new `RequirementsPage`.

---
---

# Phase 3.1 — ZK Proof Integration, Verification & Infrastructure

This section covers everything added after the original Phase 3 UI work: real
Groth16 ZK proof generation/verification, per-channel proving keys, the
range-compliance check, and a batch of infrastructure/stability fixes.

---

## A. ZK Proof System (gnark / Groth16, BN254)

Three Go binaries under `zk/` form the proving system:

| Binary | Role | Who runs it |
|--------|------|-------------|
| `vc-setup` | Trusted setup → produces `circuit.pk` + `circuit.vk` for a channel | Manufacturer (via backend) |
| `vc-quickprove` | Generates a proof from a CSV using `circuit.pk` | Supplier (locally) |
| `vc-quickverify` | Verifies a proof using `circuit.vk` | Manufacturer (via backend) |

Key facts:
- `circuit.pk`/`circuit.vk` are **per-channel, not per-order**. Same `pk` proves
  every order on a channel; only regenerated when requirements change.
- The supplier generates proofs **locally** — raw QC CSV never leaves their
  machine. Only the proof + aggregate public stats go on-chain (zero-knowledge).
- Batch size (`--rows`) is **set by the manufacturer** in the Requirements form,
  not hardcoded.

---

## B. Backend Changes

### B1. Extended: `backend/src/models/ChannelRequirement.js`
Added ZK fields on top of the Phase 3 fields:
- `params[]` now also carries `min` / `max` per parameter (range bounds).
- `batchRows` — CSV rows per proof (manufacturer-defined batch size).
- `zkeyStatus` — `'generating' | 'ready' | 'failed'`.
- `zkeyError` — error text when setup fails.
- `pkPath` / `vkPath` — absolute paths to the generated keys on the server.

### B2. Extended: `backend/src/routes/channelReqs.js`
- `runSetup()` — spawns `vc-setup` in the background (`detached: true`, **no**
  `child.unref()` so close/error handlers still fire). Streams stdout/stderr to
  the backend console, prints a 30s heartbeat, and on success flips
  `zkeyStatus → 'ready'` with `pkPath`/`vkPath`. On failure → `'failed'`.
- Passes OEM `--mins` / `--maxs` to `vc-setup` from the saved param ranges.
- `POST /channel-reqs` now stores ranges + `batchRows` and triggers setup.
- `GET /channel-reqs/pk?channelId=` — supplier downloads `circuit.pk`
  (guards: keys must be `ready` and file must exist). `circuit.vk` is **never**
  served — it stays on the server.
- Exports `runSetupForReq(req)` for the startup healer.

### B3. Extended: `backend/src/routes/orders.js`
- **Proof storage**: on `POST /orders/:id/fulfill`, the uploaded `.proof` and
  `public.json` are saved to `backend/proofs/<channelName>/<orderId>/` (in
  addition to being stored on-chain).
- **New endpoint `POST /orders/:id/run-verify`**: the OEM verification step.
  1. Reads proof + public signals from the chain.
  2. Looks up `circuit.vk` from the channel's requirements (server-side only).
  3. Runs `vc-quickverify` as a subprocess (exit 0 = valid, exit 2 = invalid).
  4. **Range-compliance check** (see Section D) — compares the proof's public
     stats against the OEM's required min/max.

### B4. Extended: `backend/src/index.js`
- **Awaited restarts**: container/orderer restarts on startup are now `await`ed
  (were fire-and-forget) so the gRPC port is actually ready before use.
- **ZK startup healer**: finds requirements stuck in `zkeyStatus: 'generating'`
  from an interrupted run. If `circuit.pk`/`circuit.vk` already exist on disk →
  marks `ready`; otherwise re-runs `vc-setup` via `runSetupForReq`.

### B5. Extended: `backend/src/fabric/gateway.js`
gRPC keepalive tuned to stop the peer rejecting pings (`excess pings` error):
```js
'grpc.keepalive_time_ms': 120_000,
'grpc.keepalive_timeout_ms': 20_000,
'grpc.keepalive_permit_without_calls': 0,
'grpc.http2.min_time_between_pings_ms': 120_000,
'grpc.http2.max_pings_without_data': 0,
```

### B6. Extended: `backend/src/fabric/provisioner.js`
`restartChannelOrderer()` now waits 8s after `docker run` so the orderer gRPC
port is accepting connections before the function returns (fixes intermittent
`connection refused` to the orderer).

### B7. New file: `backend/nodemon.json`
Fixes an **infinite restart loop**: `vc-setup` writes keys into `backend/keys/`,
which nodemon was watching → restart → startup healer respawns `vc-setup` →
loop. Config restricts the watch to `src/` and ignores the generated folders:
```json
{ "watch": ["src"], "ext": "js,json", "ignore": ["keys/**", "proofs/**"] }
```

---

## C. Network / Infra Changes

### C1. Modified: `network/scripts/resetNetwork.sh`
On reset, also wipes ZK artifacts so a clean network starts with no stale keys:
- `rm -rf backend/keys` (all generated `pk`/`vk`).
- `rm -rf backend/proofs` then recreate empty (all supplier proof files).

### C2. Modified: `network/config/platform.json`
`sequence` reset to `1` (was left at `2` from a prior chaincode upgrade — caused
`sequence 2 > next available 1` on a clean deploy).

### C3. Operational note: `/etc/hosts`
Each network wipe regenerates orgs/orderers with **new random domain suffixes**,
so the orderer/peer hostnames must be re-added to `/etc/hosts` (pointing at
`127.0.0.1`) after every reset, or the gateway resolves them to a public IP and
times out.

---

## D. Range-Compliance Check (correctness fix)

**Problem discovered:** a deliberately out-of-range CSV still verified as VALID.
Root cause is in `zk/circuits/flex_circuit.go` — the circuit's `min`/`max`
constraints use the **batch's own** min/max (trivially true), not the OEM's
required range. The OEM's `--mins`/`--maxs` were passed to `vc-setup` but never
wired into circuit constraints.

**Fix (application layer)** in `POST /orders/:id/run-verify`:
after the cryptographic proof passes, the backend compares each parameter's
public `min`/`max` against the OEM's stored `min`/`max`. If any value is out of
range it returns:
```json
{
  "valid": false,
  "output": "PROOF VALID but batch is OUT OF SPEC: ...",
  "violations": ["voltage: batch max 42.1 > required max 37"],
  "orderID": "ORDER-xxx"
}
```

> Note: the proper long-term fix is to make the OEM min/max **public circuit
> inputs** so the proof itself encodes range compliance. The app-layer check is
> correct and sufficient for now since the OEM controls the backend.

---

## E. Frontend Changes

### E1. Rewritten: `frontend/src/pages/RequirementsPage.jsx`
- One **`ChannelReqCard` per active channel** (channel name + partner + ZK badge).
- Read-only stats table + an Edit section (manufacturer only) that re-saves
  requirements and **regenerates ZK keys**.
- Manufacturer table shows min/max columns; supplier sees name/value/unit only.
- Supplier card has a **Download `circuit.pk`** button + the `vc-quickprove` CLI
  hint. Warns that the supplier must re-download `circuit.pk` after the
  manufacturer regenerates keys.
- Bottom "jump to channel" picker that scrolls to and auto-opens a card.

### E2. Modified: `frontend/src/pages/DashboardNew.jsx`
- **Org search** box (filters by name / type / mspId / what-they-make).
- **Self card removed** — the logged-in org no longer sees its own card; the
  grid filters out `org._id === myId` and banned orgs.

### E3. Modified: `frontend/src/pages/OrderDetail.jsx`
- Back-to-Orders button, file-picker fields for `.proof` / `.public.json`, and a
  dark terminal-style `vc-quickprove` CLI hint.
- **Three-state verification result** (was only green/red):
  | Result | Box color | Label |
  |--------|-----------|-------|
  | Crypto valid + within range | 🟢 Green | `PROOF VALID — WITHIN SPEC` |
  | Crypto valid + out of range | 🟡 Amber | `PROOF VALID — BATCH OUT OF SPEC` |
  | Crypto invalid | 🔴 Red | `PROOF INVALID` |
- Out-of-spec case lists each violation; the raw `output` is suppressed in that
  case to avoid showing the same message twice.
- Toast messages updated to distinguish out-of-spec from a real crypto failure.

### E4. Modified: `frontend/src/services/api.js`
- `channelReqsService.save(channelId, params, batchRows)` — now sends batch size.
- `channelReqsService.downloadPk(channelId)` — blob download of `circuit.pk`.
- `orderService.runVerify(...)` — calls the new `/orders/:id/run-verify`.

---

## F. Verification Flow (end-to-end summary)

```
Manufacturer sets requirements (params + min/max + batch size)
        │  POST /channel-reqs → vc-setup (background)
        ▼
circuit.pk + circuit.vk written to backend/keys/channels/<channelId>/
        │
Supplier downloads circuit.pk  ──►  runs vc-quickprove LOCALLY on CSV
        │                              (raw data never leaves their machine)
        ▼
Supplier uploads .proof + public.json  →  POST /orders/:id/fulfill
        │  stored on-chain + backend/proofs/<channel>/<order>/
        ▼
Manufacturer clicks Run ZK Verification  →  POST /orders/:id/run-verify
        │  (1) vc-quickverify with circuit.vk  → crypto valid?
        │  (2) range check vs OEM min/max        → within spec?
        ▼
🟢 VALID — WITHIN SPEC   🟡 VALID — OUT OF SPEC   🔴 INVALID
        ▼
Manufacturer Accepts (VerifyAndAccept) or Rejects (RejectOrder)
```
