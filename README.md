# VeritasChain — Industrial B2B Blockchain on Hyperledger Fabric 2.5

A permissioned blockchain platform where manufacturers and suppliers can register, open private supply chain channels, create orders, and verify component quality using ZK proofs — without exposing trade secrets to anyone outside the channel.

---

## Team

| Module | Owner |
|---|---|
| Hyperledger Fabric Network + Backend API | @vrd-cse |
| ZK Verifier + ZKML Model | Pranav |
| React.js Frontend + Dashboard | Pranav |

---

## How It Works

```
1. Register   — Any org registers. Gets a cryptographic identity (MSP) on Fabric.
2. Connect    — Two orgs request a channel with each other. When both accept,
                a private Fabric channel + dedicated orderer is provisioned automatically.
3. Order      — Manufacturer creates an order on-chain: component, specs, quantity, deadline.
4. Fulfill    — Supplier runs ZK prover → uploads 4 files to AWS S3 →
                submits URLs + SHA-256 hashes on-chain via FulfillOrder.
5. Verify     — Manufacturer downloads files, checks hashes, runs ZK verifier locally →
                calls VerifyAndAccept or RejectOrder.
6. Feedback   — Manufacturer submits permanent on-chain feedback. Builds reputation.
```

---

## Repository Structure

```
VoltRide_project/
├── chaincode/order/order.go      ← The blockchain smart contract (Go)
├── network/
│   ├── config/
│   │   ├── platform.json         ← Orderer config (ports, chaincode name)
│   │   ├── core.yaml             ← Peer node config
│   │   └── orderer.yaml          ← Orderer node config
│   ├── docker/
│   │   ├── docker-compose-ca.yaml      ← Orderer CA container
│   │   └── docker-compose-network.yaml ← Orderer node container
│   └── scripts/
│       ├── startNetwork.sh             ← Start the orderer (run once)
│       ├── resetNetwork.sh             ← Wipe everything and start fresh
│       ├── provisionOrg.sh             ← Enroll a new org's identity
│       ├── provisionChannelOrderer.sh  ← Start a per-channel orderer
│       ├── createChannel.sh            ← Create a private channel
│       └── deployChaincode.sh          ← Deploy veritasorder chaincode
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express entry point (port 3000)
│   │   ├── routes/
│   │   │   ├── orgs.js           ← POST /orgs/register, GET /orgs
│   │   │   ├── channels.js       ← POST /channels/request, GET /channels
│   │   │   └── orders.js         ← All order endpoints (see API section)
│   │   ├── fabric/
│   │   │   ├── gateway.js        ← Fabric Gateway SDK connection
│   │   │   ├── provisioner.js    ← Dynamic org/channel/orderer provisioning
│   │   │   ├── configGenerator.js← Generates configtx.yaml per channel
│   │   │   └── portManager.js    ← Dynamic port assignment for containers
│   │   ├── models/
│   │   │   ├── Org.js            ← MongoDB schema for orgs
│   │   │   └── Channel.js        ← MongoDB schema for channels
│   │   └── config/db.js          ← MongoDB connection
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/client.js         ← All fetch() calls in one place
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Dashboard.jsx
│   │   └── components/
│   │       ├── Discover.jsx      ← Find orgs, request channels
│   │       ├── ChannelView.jsx   ← Orders list, new order modal
│   │       └── OrderCard.jsx     ← Fulfill / Accept / Reject / Feedback
│   ├── package.json
│   └── vite.config.js            ← Proxy: /orders → localhost:3000
└── docker-compose-platform.yaml  ← Starts MongoDB only
```

---

## Prerequisites

Install all of these before running anything:

| Tool | Version | Install |
|---|---|---|
| Docker | 24+ | https://docs.docker.com/get-docker |
| Docker Compose | v2 | included with Docker Desktop |
| Node.js | 18+ | https://nodejs.org |
| Go | 1.21+ | https://go.dev/dl |
| Fabric binaries | 2.5 | see below |

**Install Hyperledger Fabric 2.5 binaries** (peer, orderer, configtxgen, osnadmin, fabric-ca-client):
```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7
# This downloads binaries into ./bin/ — add to PATH:
export PATH=$PWD/bin:$PATH
```
Or download manually from https://github.com/hyperledger/fabric/releases/tag/v2.5.0

**Pull Docker images:**
```bash
docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-ca:latest
```

---

## Running the Platform

### Step 1 — Clone and install dependencies

```bash
git clone https://github.com/vrd-cse/VoltRide_project.git
cd VoltRide_project

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### Step 2 — Start MongoDB

```bash
docker-compose -f docker-compose-platform.yaml up -d
```

MongoDB runs on port 27017. This is where org metadata and channel records are stored.

### Step 3 — Create the Docker network

```bash
docker network create veritaschain
```

All Fabric containers (peers, orderers, CAs) run on this network.

### Step 4 — Start the Fabric orderer

```bash
cd network
./scripts/startNetwork.sh
cd ..
```

This starts the root orderer CA and the shared orderer node. **Run this only once.** It wipes and rebuilds the `organizations/` directory.

### Step 5 — Start the backend

```bash
cd backend
npm run dev
```

Backend runs on **port 3000**. Uses nodemon — auto-restarts on file changes.

### Step 6 — Start the frontend

```bash
cd frontend
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## To Start Fresh (wipe everything and restart)

```bash
cd network && ./scripts/resetNetwork.sh && cd ..
```

Then delete the MongoDB org/channel data:
```bash
# Connect to mongo and drop the collections, or just restart with a fresh DB
docker-compose -f docker-compose-platform.yaml down -v
docker-compose -f docker-compose-platform.yaml up -d
```

Then redo Steps 2–6 above.

---

## API Reference

Base URL: `http://localhost:3000`

### Org endpoints

```
POST /orgs/register
Body: {
  "name":        "Tata Motors",
  "type":        "manufacturer",     // "manufacturer" or "supplier"
  "whatTheyMake": "EV chassis",
  "address":     "Mumbai, India",
  "contact":     "tata@example.com"
}
→ Returns org object. fabricStatus goes: pending → provisioning → active (~30s)

GET /orgs?status=active
→ Returns array of all active orgs
```

### Channel endpoints

```
POST /channels/request
Body: { "fromOrgId": "<mongoId>", "toOrgId": "<mongoId>" }
→ Records the request. When BOTH orgs request each other:
  a new orderer + peer channel is provisioned automatically (~2 min)

GET /channels?orgId=<mongoId>
→ Returns all channels for that org (populated with partner org details)
```

### Order endpoints

```
POST /orders
Body: {
  "channel":        "ch-tatamotors-exide",
  "mspId":          "TataMotorsMSP",
  "orderID":        "ORD-2026-001",
  "quantity":       500,
  "componentType":  "battery",
  "specifications": "{\"capacity\":\"100kWh\",\"voltage\":\"400V\"}",
  "supplierMSP":    "ExideMSP",
  "deadline":       "2026-07-01T00:00:00Z"
}

GET /orders?channel=ch-tatamotors-exide&mspId=TataMotorsMSP
→ Returns all orders on that channel

GET /orders/:id?channel=ch-tatamotors-exide&mspId=TataMotorsMSP
→ Returns single order

GET /orders/:id/history?channel=ch-tatamotors-exide&mspId=TataMotorsMSP
→ Returns full audit trail (every state change, who made it, when)
```

### ZK Proof endpoints (Pranav's integration)

```
POST /orders/:id/fulfill
Body: {
  "channel":      "ch-tatamotors-exide",
  "mspId":        "ExideMSP",
  "batchID":      "BATCH-2026-001",

  "vkURL":        "https://s3.amazonaws.com/.../circuit.vk",
  "pfURL":        "https://s3.amazonaws.com/.../proof.pf",
  "srhURL":       "https://s3.amazonaws.com/.../signals.srh",
  "settingsURL":  "https://s3.amazonaws.com/.../settings.json",

  "vkHash":       "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  "pfHash":       "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  "srhHash":      "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  "settingsHash": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b"
}
→ Order status: PENDING → FULFILLED
  The 4 hashes are the tamper-evident seal stored immutably on-chain.

POST /orders/:id/verify
Body: { "channel": "ch-tatamotors-exide", "mspId": "TataMotorsMSP" }
→ Order status: FULFILLED → ACCEPTED

POST /orders/:id/reject
Body: { "channel": "ch-tatamotors-exide", "mspId": "TataMotorsMSP", "reason": "ZK proof failed" }
→ Order status: FULFILLED → REJECTED

POST /orders/:id/feedback
Body: { "channel": "ch-tatamotors-exide", "mspId": "TataMotorsMSP", "feedbackText": "On time delivery, quality meets spec." }
→ Permanent on-chain feedback (can only be submitted once, on ACCEPTED or REJECTED)
```

---

## ZK Proof Integration — What Pranav Needs to Do

The FulfillOrder call is where the ZK system connects to the blockchain.

### The 4 ZK files

| File | What it is |
|---|---|
| `.vk` | Verification key — the circuit's public parameters |
| `.pf` | Proof file — the ZK proof that the batch meets spec |
| `.srh` | Public signals — the public inputs to the proof |
| `settings.json` | Circuit settings / parameters |

All 4 are public — safe to upload to S3. The proof mathematically shows the batch meets the spec without revealing raw production data.

### Pranav's workflow

```python
# 1. Get the PENDING order
order = GET /orders?channel=ch-tatamotors-exide&mspId=ExideMSP
# Filter: order["status"] == "PENDING"

# 2. Read specifications from the order
specs = json.loads(order["specifications"])  
# e.g. {"capacity": "100kWh", "voltage": "400V", "SOH_min": "95%"}

# 3. Run ML model on the batch to get production metrics
metrics = ml_model.run(batch_data)

# 4. Run ZK prover
vk, pf, srh, settings = zk_prover.prove(circuit, metrics, specs)

# 5. Upload all 4 files to S3
vk_url  = s3.upload("circuit.vk",    vk)
pf_url  = s3.upload("proof.pf",      pf)
srh_url = s3.upload("signals.srh",   srh)
set_url = s3.upload("settings.json", settings)

# 6. Compute SHA-256 of each file
vk_hash  = sha256(vk)
pf_hash  = sha256(pf)
srh_hash = sha256(srh)
set_hash = sha256(settings)

# 7. Submit to blockchain — this is the only call Pranav makes to the API
POST /orders/{order["orderID"]}/fulfill
{
  "channel": "ch-tatamotors-exide",
  "mspId":   "ExideMSP",
  "batchID": "BATCH-2026-001",
  "vkURL": vk_url,   "pfURL": pf_url,   "srhURL": srh_url,   "settingsURL": set_url,
  "vkHash": vk_hash, "pfHash": pf_hash, "srhHash": srh_hash, "settingsHash": set_hash
}
```

### What the chaincode validates
- All 4 URLs must start with `https://`
- All 4 hashes must be exactly 64 hexadecimal characters (SHA-256)
- Caller's MSP must match the `supplierMSP` on the order
- Order must be in PENDING status

---

## The Order Data Structure

Every order on-chain looks like this:

```json
{
  "orderID":        "ORD-2026-001",
  "manufacturerMSP": "TataMotorsMSP",
  "supplierMSP":     "ExideMSP",
  "componentType":   "battery",
  "quantity":        500,
  "specifications":  "{\"capacity\":\"100kWh\"}",
  "deadline":        "2026-07-01T00:00:00Z",
  "status":          "PENDING",
  "createdAt":       "2026-06-07T10:00:00Z",

  "batchID":         "",
  "vkURL":           "",
  "pfURL":           "",
  "srhURL":          "",
  "settingsURL":     "",
  "vkHash":          "",
  "pfHash":          "",
  "srhHash":         "",
  "settingsHash":    "",
  "fulfilledAt":     "",

  "verificationResult": "",
  "rejectionReason":    "",
  "verifiedBy":         "",
  "verifiedAt":         "",

  "feedbackText":    "",
  "feedbackAt":      ""
}
```

Status lifecycle: `PENDING → FULFILLED → ACCEPTED / REJECTED → (feedback added)`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Hyperledger Fabric 2.5 |
| Consensus | Raft (one dedicated orderer per channel) |
| Smart Contracts | Go — `fabric-contract-api-go` |
| Infrastructure | Docker (containers started dynamically) |
| Off-chain DB | MongoDB (org + channel metadata) |
| Off-chain Storage | AWS S3 (ZK proof files) |
| Platform Backend | Node.js + Express (port 3000) |
| Frontend | React 18 + Vite (port 5173) |
| ZK Proofs | ZKML — Pranav's module |

---

*VeritasChain — Built at BIT Mesra, 2026*
