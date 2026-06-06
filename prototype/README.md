# VoltRide Prototype — VeritasChain Local Demo

> **This is the VoltRide prototype.** It is a fully working local blockchain network
> that demonstrates the VeritasChain concept using an EV scooter supply chain as the example.
> Run this first if you are new to the project — it shows exactly how the system works
> before looking at the platform-level code.

---

## What This Demonstrates

VoltRide (an EV scooter manufacturer) procures 3 components from 3 suppliers:

| Channel | Manufacturer | Supplier |
|---|---|---|
| `batterychannel` | VoltRideOrg | BatteryOrg |
| `motorchannel` | VoltRideOrg | MotorOrg |
| `chassischannel` | VoltRideOrg | ChassisOrg |

Each channel is private — BatteryOrg cannot see what VoltRide pays MotorOrg.

The full order lifecycle runs on-chain:
```
VoltRide creates order → Supplier fulfills with ZK proof → VoltRide verifies → ACCEPTED / REJECTED
```

---

## Relationship To The Full Platform

```
This prototype (VoltRide)          Full VeritasChain Platform
──────────────────────────         ──────────────────────────
4 orgs, hardcoded           →      Any org can register dynamically
3 fixed channels            →      Channels created on demand
Component-specific QC       →      Universal order chaincode
Local demo only             →      Production-ready API layer
```

The prototype was built first to validate the concept. The full platform
generalizes everything in this prototype to work for any industry.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VoltRide Network                        │
│                                                             │
│  ┌──────────────┐   batterychannel   ┌──────────────────┐  │
│  │  BatteryOrg  │◄──────────────────►│                  │  │
│  │  peer0:7051  │                    │   VoltRideOrg    │  │
│  └──────────────┘   motorchannel     │  peerbattery     │  │
│  ┌──────────────┐◄──────────────────►│  :11051          │  │
│  │   MotorOrg   │                    │  peermotor       │  │
│  │  peer0:9051  │   chassischannel   │  :12051          │  │
│  └──────────────┘◄──────────────────►│  peerchassis     │  │
│  ┌──────────────┐                    │  :13051          │  │
│  │  ChassisOrg  │                    └──────────────────┘  │
│  │ peer0:10051  │                                          │
│  └──────────────┘                                          │
│                    ┌─────────────────┐                     │
│                    │  OrdererOrg     │                     │
│                    │  EtcdRaft :7050 │                     │
│                    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Docker
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Hyperledger Fabric Binaries
```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5
echo 'export PATH=$PATH:$HOME/fabric-samples/bin' >> ~/.bashrc
source ~/.bashrc
peer version   # should show: hyperledger fabric 2.5.x
```

### 3. Required Docker Images
```bash
docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-ca:latest
docker pull hyperledger/fabric-ccenv:2.5
docker pull hyperledger/fabric-baseos:2.5
```

### 4. Go (only needed if modifying chaincode)
```bash
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version
```

---

## Running The Prototype

Run all commands from inside the `prototype/` folder:

```bash
cd prototype/
```

### Step 1 — Add DNS entries (CRITICAL — do not skip)
```bash
sudo bash -c 'cat >> /etc/hosts << EOF
127.0.0.1 peer0.battery.example.com
127.0.0.1 peer0.motor.example.com
127.0.0.1 peer0.chassis.example.com
127.0.0.1 peerbattery.voltride.example.com
127.0.0.1 peermotor.voltride.example.com
127.0.0.1 peerchassis.voltride.example.com
127.0.0.1 orderer0.example.com
EOF'
```

### Step 2 — Start CAs
```bash
docker compose -f docker/docker-compose-ca.yaml up -d
sleep 5
docker ps | grep ca_   # 5 CA containers should show Up
```

### Step 3 — Start Network
```bash
docker compose -f docker/docker-compose-network.yaml up -d
sleep 10
docker ps --format "table {{.Names}}\t{{.Status}}"
# Expected: 7 containers Up — orderer + 6 peers
```

### Step 4 — Deploy Everything
```bash
chmod +x deploy-and-test.sh
./deploy-and-test.sh 2>&1 | tee deploy-output.txt
```

**Success looks like:**
```
=============================================
 BLOCKCHAIN LAYER COMPLETE - ALL TESTS DONE
=============================================
```

---

## Order Lifecycle

```
VoltRide creates order  →  [PENDING]
                                │
               ┌────────────────┴────────────────┐
               │                                 │
        FulfillOrder                        CancelOrder
               │                                 │
          [FULFILLED]                       [CANCELLED]
               │
    ┌──────────┴──────────┐
    │                     │
VerifyAndAccept       RejectOrder
    │                     │
[ACCEPTED]           [REJECTED]
```

---

## Chaincode API Reference

### Battery — `batterychannel`

**CreateOrder** (VoltRide only)
```json
{ "Args": ["CreateOrder", "BAT-001", "100", "{\"vehicleModel\":\"VR-S1\"}"] }
```

**FulfillOrder** (BatteryOrg only)
```json
{
  "Args": ["FulfillOrder", "BAT-001", "BATCH-001",
    "{\"nominalVoltage\":3.7,\"internalResistance\":25.0,\"capacity\":50.0,\"soh\":95.0,\"selfDischargeRate\":2.0,\"temperatureAtDelivery\":25.0}",
    "<64-char-sha256-hex>",
    "<base64-zk-proof>"
  ]
}
```

**VerifyAndAccept** (VoltRide only)
```json
{ "Args": ["VerifyAndAccept", "BAT-001"] }
```

**RejectOrder** (VoltRide only)
```json
{ "Args": ["RejectOrder", "BAT-001", "SOH below threshold"] }
```

### QC Parameter Ranges

| Component | Parameter | Unit | Valid Range |
|---|---|---|---|
| Battery | nominalVoltage | V | 2.5 – 4.5 |
| Battery | internalResistance | mΩ | 0 – 500 |
| Battery | capacity | Ah | 1 – 500 |
| Battery | soh | % | 0 – 100 |
| Battery | selfDischargeRate | %/month | 0 – 10 |
| Battery | temperatureAtDelivery | °C | -40 – 85 |
| Motor | ratedPower | kW | 0.1 – 100 |
| Motor | noLoadRpm | RPM | 100 – 20000 |
| Motor | phaseWindingResistance | Ω | 0.001 – 50 |
| Motor | torqueOutput | Nm | 0.1 – 500 |
| Motor | hallSensorOutput | V | 0 – 12 |
| Motor | efficiency | % | 0 – 100 |
| Chassis | weldQuality | score | 0 – 100 |
| Chassis | frameWeight | kg | 1 – 100 |
| Chassis | dimensionalAccuracy | mm | 0 – 50 |
| Chassis | materialGrade | string | non-empty |
| Chassis | surfaceDefectCount | count | ≥ 0 |
| Chassis | loadBearingCapacity | kg | 1 – 5000 |

---

## Port Reference

| Container | Port |
|---|---|
| orderer0.example.com | 7050 |
| peer0.battery.example.com | 7051 |
| peer0.motor.example.com | 9051 |
| peer0.chassis.example.com | 10051 |
| peerbattery.voltride.example.com | 11051 |
| peermotor.voltride.example.com | 12051 |
| peerchassis.voltride.example.com | 13051 |
| ca_voltride | 7054 |
| ca_battery | 8054 |
| ca_motor | 9054 |
| ca_chassis | 10054 |
| ca_orderer | 11054 |

---

## Stopping / Resetting

```bash
# Stop (preserves ledger)
docker compose -f docker/docker-compose-network.yaml down
docker compose -f docker/docker-compose-ca.yaml down

# Full wipe and restart from scratch
docker compose -f docker/docker-compose-network.yaml down
sudo rm -rf ledger/orderer0/* ledger/peer0.battery/* ledger/peer0.motor/*
sudo rm -rf ledger/peer0.chassis/* ledger/peerbattery.voltride/*
sudo rm -rf ledger/peermotor.voltride/* ledger/peerchassis.voltride/*
docker compose -f docker/docker-compose-network.yaml up -d
sleep 10
./deploy-and-test.sh
```

---

## Troubleshooting

**Chaincode exits with code 2** — DNS issue. Verify `/etc/hosts` has all 7 entries from Step 1.

**"sequence must be N" on approve/commit** — chaincode already committed at a higher sequence. Query the committed sequence and increment.

**"ledger already exists"** — peers already joined. Skip channel create, proceed to chaincode install.

**Permission denied on git operations**
```bash
sudo find organizations/ -type d -exec chmod 755 {} \;
sudo find organizations/ -type f -exec chmod 644 {} \;
```
