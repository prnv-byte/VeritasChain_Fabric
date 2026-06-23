# VoltRide-Network — VeritasChain Platform

A Hyperledger Fabric 2.5 blockchain platform for EV supply chain management. Manufacturers and suppliers connect through private channels, create orders, fulfill them with ZK proof attachments, and verify them — all recorded immutably on-chain.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                     │
│                    http://localhost:4000                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (Vite proxy)
┌──────────────────────────▼──────────────────────────────────┐
│                  Backend (Node.js/Express)                   │
│                    http://localhost:3000                     │
│                                                              │
│   ┌──────────────────┐        ┌───────────────────────────┐ │
│   │  MongoDB Atlas   │        │   Hyperledger Fabric 2.5  │ │
│   │  (cloud)         │        │   (local Docker)          │ │
│   │                  │        │                           │ │
│   │  - Orgs          │        │  - Orders (on-chain)      │ │
│   │  - Channels      │        │  - Fulfillments           │ │
│   │  - Platform meta │        │  - Verifications          │ │
│   └──────────────────┘        │  - Feedback               │ │
│                               └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Install ALL of these before running the project.

### 1. Docker
```bash
docker --version        # Docker 24+
docker compose version  # Docker Compose v2+
```

### 2. Node.js
```bash
node --version   # v18+
npm --version    # v9+
```

### 3. Go
```bash
go version   # go1.21+
```

### 4. Hyperledger Fabric Binaries

The following binaries must be available in your PATH:
`peer`, `orderer`, `configtxgen`, `configtxlator`, `osnadmin`, `fabric-ca-client`

Install them:
```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7
```

Add to PATH in your `~/.bashrc` or `~/.zshrc`:
```bash
export PATH=$PATH:/path/to/fabric-samples/bin
```

Verify:
```bash
peer version
fabric-ca-client version
configtxgen --version
```

### 5. Python3
```bash
python3 --version   # 3.8+
```

### 6. MongoDB Compass (optional — to view Atlas data visually)
Download from: https://www.mongodb.com/try/download/compass

---

## MongoDB Atlas Setup

The platform uses MongoDB Atlas (cloud) to store org and channel metadata.

1. Go to https://www.mongodb.com/atlas → Sign up free
2. Create a free **M0 cluster**
3. Go to **Database Access** → Add a database user (set username + password)
4. Go to **Network Access** → Add IP → Allow access from anywhere (`0.0.0.0/0`)
5. Go to your cluster → **Connect** → **Drivers** → copy the connection string

Connection string looks like:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/
```

---

## Environment Setup

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your values:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/veritaschain
PORT=3000
PLATFORM_SECRET=veritaschain_2626
ADMIN_KEY=vc_admin_secret_2626

# SMTP configuration for email delivery
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=no-reply@veritaschain.com
APP_BASE_URL=http://localhost:5173
```

> **Important:** All team members must use the **same `PLATFORM_SECRET`** so org identifiers match across systems.

---

## Running the Project

Open **3 separate terminals**.

### Terminal 1 — Start Fabric Network

```bash
cd network
sudo bash scripts/startNetwork.sh
```

Wait until you see:
```
Orderer ready. Register orgs via API.
Orderer gRPC : localhost:7050
Orderer admin: localhost:7053
```

### Terminal 2 — Start Backend

```bash
cd backend
npm install       # first time only
npm start
```

Wait until you see:
```
MongoDB connected: mongodb+srv://...
VeritasChain backend running on port 3000
```

### Terminal 3 — Start Frontend

```bash
cd frontend
npm install       # first time only
npm run dev
```

Open browser at: **http://localhost:4000**

---

## Using the Platform

### Step 1: Register Organizations

- Go to `http://localhost:4000/register`
- Register a **Manufacturer** org (type: manufacturer)
- Register a **Supplier** org (type: supplier)
- Wait ~30-40 seconds for each org to show `active` status

### Step 2: Create a Channel

- Log in as **Manufacturer** → Discover → find Supplier → click **Request Channel**
- Log out → Log in as **Supplier** → Discover → find Manufacturer → click **Accept Channel**
- Wait ~3-5 minutes for channel to become `active`

### Step 3: Create an Order (Manufacturer only)

- Log in as **Manufacturer** → open the active channel
- Click **+ New Order** → fill in details → **Create Order**

### Step 4: Fulfill the Order (Supplier only)

- Log in as **Supplier** → open the active channel
- Find the PENDING order → click **Fulfill Order**
- Fill in Batch ID, ZK proof URLs and SHA-256 hashes
- Click **"Fill demo values"** to auto-fill for testing → **Submit Fulfillment**

### Step 5: Verify or Reject (Manufacturer only)

- Log in as **Manufacturer** → find the FULFILLED order
- Click **Accept** or **Reject** (with reason)

### Step 6: Add Feedback (Manufacturer)

- After Accept/Reject → click **Add Feedback**

---

## Admin Panel

Access the admin control panel at:
```
http://localhost:4000/admin
```

Or click **System Admin** in the footer of the landing page.

**Login key:** `vc_admin_secret_2626`
> Change this in `backend/.env` → `ADMIN_KEY`

| Action | Effect |
|--------|--------|
| **Ban** org | Removes from platform login instantly. Reversible. |
| **Full Eviction** | Removes from Fabric + revokes certs + stops containers. Irreversible. |
| **Restore Access** | Unbans a banned org |
| **Remove Channel** | Deletes channel from platform |

---

## Port Reference

| Service | Port |
|---------|------|
| Frontend (React) | 4000 |
| Backend (Node.js) | 3000 |
| Fabric Orderer gRPC | 7050 |
| Fabric Orderer Admin | 7053 |
| Orderer CA | 11054 |
| Org CA (first org) | 7054 |
| Org Peer (first org) | 7051 |
| Per-channel Orderer | 8050+ |
| MongoDB Atlas | Cloud |

---

## Stopping the Network

```bash
cd network
sudo bash scripts/stopNetwork.sh
```

Stop backend and frontend with `Ctrl+C` in their terminals.

---

## Full Reset (Wipe Everything and Start Fresh)

```bash
# 1. Wipe Fabric network (containers + crypto + ledger)
cd network
sudo bash scripts/resetNetwork.sh

# 2. Clean Docker garbage
docker container prune -f

# 3. Wipe Atlas database
cd ../backend
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await mongoose.connection.db.dropDatabase();
  console.log('Atlas cleared');
  process.exit(0);
});
"
```

After this, start again from Terminal 1.

---

## Project Structure

```
VoltRide-Network/
├── backend/
│   ├── .env.example                 # Copy to .env and fill in values
│   └── src/
│       ├── config/db.js             # MongoDB Atlas connection
│       ├── fabric/
│       │   ├── gateway.js           # Fabric Gateway SDK connection
│       │   ├── provisioner.js       # Org + channel provisioning
│       │   ├── configGenerator.js   # Generates per-channel configtx.yaml
│       │   └── portManager.js       # Dynamic port assignment
│       ├── models/
│       │   ├── Org.js               # Organization schema
│       │   └── Channel.js           # Channel schema
│       └── routes/
│           ├── orgs.js              # POST /orgs/register, GET /orgs
│           ├── channels.js          # POST /channels/request, GET /channels
│           ├── orders.js            # All order lifecycle routes
│           └── admin.js             # Admin-only routes (key protected)
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Landing.jsx          # Home page
│       │   ├── Register.jsx         # Org registration form
│       │   ├── Login.jsx            # Org selection / login
│       │   ├── Dashboard.jsx        # Main app dashboard
│       │   └── Admin.jsx            # Admin control panel
│       └── components/
│           ├── ChannelView.jsx      # Channel + orders view
│           ├── Discover.jsx         # Find orgs + request channels
│           └── OrderCard.jsx        # Single order with all actions
│
├── chaincode/order/
│   └── order.go                     # Go chaincode: Create→Fulfill→Verify→Feedback
│
└── network/
    ├── config/
    │   ├── core.yaml                # Peer configuration
    │   ├── orderer.yaml             # Orderer configuration
    │   └── platform.json            # Chaincode + orderer settings
    ├── docker/
    │   ├── docker-compose-network.yaml   # Orderer container
    │   └── docker-compose-ca.yaml        # Orderer CA container
    └── scripts/
        ├── startNetwork.sh          # Start orderer + CA
        ├── stopNetwork.sh           # Stop all containers
        ├── resetNetwork.sh          # Wipe everything
        ├── provisionOrg.sh          # Enroll org identity
        ├── provisionChannelOrderer.sh   # Enroll per-channel orderer
        ├── createChannel.sh         # Create Fabric channel
        ├── deployChaincode.sh       # Install + approve + commit chaincode
        └── removeOrg.sh             # Admin: full org eviction from network
```

---

## Troubleshooting

### Backend won't connect to MongoDB
- Check `MONGODB_URI` in `.env`
- Ensure Atlas Network Access allows `0.0.0.0/0`
- Restart backend after editing `.env`

### Org stuck in "provisioning" after backend restart
- Backend resets any `provisioning` org to `failed` on startup (safety mechanism)
- If Docker containers for that org are running, manually set status to active:
```bash
cd backend
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Org = require('./src/models/Org');
  await Org.updateMany({ fabricStatus: 'failed' }, { fabricStatus: 'active' });
  console.log('Done'); process.exit(0);
});
"
```

### Channel stuck on "Retry Channel"
- Check backend terminal for exact error message
- Most common cause: stale files from a previous failed run
- Fix: do a full reset and start fresh

### Port already in use
```bash
sudo ss -tlnp | grep <port>
sudo kill -9 <pid>
```

### Docker containers from previous run blocking startup
```bash
docker container prune -f
```

---

## Data Storage

| Data | Stored In | Wiped By |
|------|-----------|---------|
| Orders, verifications, feedback | Fabric ledger (Docker volumes) | `resetNetwork.sh` |
| Org registrations, channels | MongoDB Atlas (cloud) | Dropping the database |
| Certificates, keys | `network/organizations/` | `resetNetwork.sh` |

> Blockchain data (orders) is **immutable** — it cannot be selectively deleted. Only a full network reset wipes it.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Hyperledger Fabric 2.5 |
| Smart Contract | Go (fabric-contract-api-go) |
| Backend API | Node.js + Express |
| Database | MongoDB Atlas + Mongoose |
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Fabric SDK | @hyperledger/fabric-gateway v1.4 |
