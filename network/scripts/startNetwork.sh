#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="${NETWORK_DIR}/scripts"

echo "================================================="
echo "  VeritasChain Network — Starting Up"
echo "================================================="

# ── 1. Start CAs ─────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Starting Certificate Authorities..."
docker compose -f ${NETWORK_DIR}/docker/docker-compose-ca.yaml up -d
echo "Waiting for CAs to be ready..."
sleep 5

# ── 2. Register + Enroll identities ──────────────────────────────────────────
echo ""
echo "[2/5] Registering and enrolling all identities..."
. ${SCRIPTS_DIR}/registerEnroll.sh
registerAll

# ── 3. Start orderer + peers ──────────────────────────────────────────────────
echo ""
echo "[3/5] Starting orderer and peer nodes..."
docker compose -f ${NETWORK_DIR}/docker/docker-compose-network.yaml up -d
echo "Waiting for nodes to start..."
sleep 5

# ── 4. Create channels and join peers ─────────────────────────────────────────
echo ""
echo "[4/5] Creating channels..."
${SCRIPTS_DIR}/createChannels.sh

# ── 5. Deploy chaincode ───────────────────────────────────────────────────────
echo ""
echo "[5/5] Deploying chaincode..."
${SCRIPTS_DIR}/deployChaincode.sh

echo ""
echo "================================================="
echo "  VeritasChain Network is UP"
echo ""
echo "  Channels:   voltride-battery | voltride-motor | voltride-chassis"
echo "  Chaincode:  veritasorder (on all 3 channels)"
echo "  API:        cd api && npm start"
echo "================================================="
