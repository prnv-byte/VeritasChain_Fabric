# VeritasChain — Open Industrial Marketplace on Hyperledger Fabric

> A permissioned blockchain platform where manufacturers and suppliers from any industry
> can register, create private channels, transact, and verify quality using ZK proofs —
> without exposing trade secrets to anyone.

---

## What Is VeritasChain

VeritasChain solves the trust problem in B2B supply chains.

When a manufacturer buys components from a supplier they don't fully trust, they face two problems:
- **Quality:** How do I know the component actually meets spec?
- **Privacy:** If I ask for raw production data to verify, the supplier exposes their trade secrets.

VeritasChain solves both using **Hyperledger Fabric private channels** (confidential transactions) and **ZK proofs** (mathematical quality verification without data exposure).

Any manufacturer. Any supplier. Any component type. One platform.

---

## How It Works

```
1. Register
   Any organization registers on VeritasChain.
   Fabric CA issues their cryptographic identity (MSP).

2. Connect
   Manufacturer invites a supplier → both accept →
   a private Fabric channel is created between them only.

3. Order
   Manufacturer creates an order on-chain:
   component type, specs, quantity, deadline.

4. Fulfill
   Supplier produces the component → runs ZK verifier locally →
   uploads 4 ZK files to AWS S3 →
   submits FulfillOrder with file URLs + SHA-256 hashes on-chain.

5. Verify
   Manufacturer downloads the 4 files → verifies each hash →
   runs ZK verifier locally → updates status: ACCEPTED or REJECTED.

6. Feedback
   Manufacturer submits permanent on-chain feedback.
   Builds the supplier's reputation record over time.
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        VeritasChain                          │
│                                                              │
│  ┌──────────────┐   private channel   ┌──────────────────┐  │
│  │ ManufacturerA│◄────────────────────►│   SupplierX      │  │
│  └──────────────┘                     └──────────────────┘  │
│                                                              │
│  ┌──────────────┐   private channel   ┌──────────────────┐  │
│  │ ManufacturerB│◄────────────────────►│   SupplierY      │  │
│  └──────────────┘                     └──────────────────┘  │
│                                                              │
│  Each pair gets their own channel — nobody sees others'      │
│  transactions. Any org can be both manufacturer and supplier.│
│                                                              │
│                    ┌─────────────────┐                       │
│                    │  Raft Orderer   │ (orders transactions) │
│                    └─────────────────┘                       │
└──────────────────────────────────────────────────────────────┘

Off-chain:
  AWS S3      — stores ZK proof files (.vk, .pf, .srh, settings.json)
  PostgreSQL  — stores AI agent summaries and reputation scores

AI Layer:
  Orchestrator Agent → Order Summary Agent
                     → Supplier Reputation Agent
                     → Deadline Monitor Agent
                     → Feedback Analyzer Agent
```

---

## Repository Structure

```
VeritasChain/
│
├── prototype/                  ← Start here if you are new
│   ├── chaincode/              VoltRide demo — works locally, fully runnable
│   │   ├── battery/            shows the concept end-to-end
│   │   ├── motor/              read prototype/README.md to run it
│   │   └── chassis/
│   ├── docker/
│   ├── organizations/
│   ├── configtx/
│   ├── scripts/
│   └── README.md               full instructions to run the demo
│
├── chaincode/
│   └── order/                  ← Universal VeritasChain chaincode
│       └── order.go            one chaincode for all orgs, all components
│
├── network/                    ← (in progress) dynamic network configs
│   ├── docker/                 supports orgs joining at runtime
│   ├── configtx/
│   └── scripts/
│
├── api/                        ← (in progress) platform backend
│   ├── registration/           POST /api/register — creates Fabric identity
│   └── channel/                POST /api/channel/create — creates private channel
│
└── README.md                   this file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Hyperledger Fabric 2.5 |
| Consensus | Raft (single-node for MVP) |
| Smart Contracts | Go — `fabric-contract-api-go` |
| Infrastructure | Docker Compose |
| Off-chain Storage | AWS S3 |
| Platform Backend | Node.js + Express |
| AI Agents | Claude API (`claude-sonnet-4-6`) |
| ZK Proofs | ZKML (Pranav's module) |
| Frontend | React.js (Pranav's module) |

---

## The Chaincode — `chaincode/order/order.go`

One universal smart contract deployed to every channel.
No hardcoded org names. Any registered org can be a manufacturer or supplier.

**Functions:**

| Function | Who calls it | What it does |
|---|---|---|
| `CreateOrder` | Manufacturer | Creates order → PENDING |
| `FulfillOrder` | Supplier | Submits ZK file URLs + hashes → FULFILLED |
| `VerifyAndAccept` | Manufacturer | Records ZK pass → ACCEPTED |
| `RejectOrder` | Manufacturer | Records ZK fail → REJECTED |
| `CancelOrder` | Manufacturer | Cancels before fulfillment → CANCELLED |
| `SubmitFeedback` | Manufacturer | Permanent on-chain feedback |
| `GetOrder` | Anyone | Read single order |
| `GetAllOrders` | Anyone | Read all orders on channel |
| `GetOrdersBySupplier` | Anyone | Supplier dashboard query |
| `GetOrdersByManufacturer` | Anyone | Manufacturer dashboard query |
| `GetOrderHistory` | Anyone | Full immutable audit trail |

**Events emitted** (for AI agent):
`OrderCreated` · `OrderFulfilled` · `OrderAccepted` · `OrderRejected` · `OrderCancelled` · `FeedbackSubmitted`

---

## ZK Proof Flow

```
Supplier machine:
  1. Produce component
  2. Run ZK verifier locally → generates 4 files:
       .vk          verification key  (public — safe to share)
       .pf          proof file        (public — safe to share)
       .srh         public signals    (public — safe to share)
       settings.json circuit params   (public — safe to share)
  3. Upload all 4 to AWS S3
  4. Compute SHA-256 hash of each file
  5. Call FulfillOrder on-chain with 4 URLs + 4 hashes

Manufacturer machine:
  6. Download 4 files from URLs
  7. Verify each file's hash matches what's on-chain (tamper check)
  8. Run ZK verifier locally
  9. If passes → VerifyAndAccept
     If fails  → RejectOrder with reason
```

The hashes on-chain are the tamper-evident seal.
If a supplier modifies a file on S3 after submission, the hash will not match.

---

## Running The Prototype First

Before building or testing the platform, run the VoltRide prototype to understand the system:

```bash
cd prototype/
cat README.md   # full instructions
```

The prototype runs entirely locally with Docker and shows the complete order lifecycle working end-to-end.

---

## Team

| Module | Owner |
|---|---|
| Hyperledger Fabric Network | @vrd-cse |
| AWS S3 + Platform Backend | @vrd-cse |
| AI Agent Layer | @vrd-cse |
| ZK Verifier + ZKML Model | Pranav |
| React.js Frontend + Dashboard | Pranav |

---

*VeritasChain — Built at BIT Mesra, 2026*
*DRDO Internship Project*
