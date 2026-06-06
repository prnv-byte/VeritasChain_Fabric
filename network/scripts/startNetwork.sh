#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="${NETWORK_DIR}/scripts"

echo "================================================="
echo "  VeritasChain Network — Starting Orderer"
echo "================================================="

# ── 0. Generate YAML configs from platform.json ───────────────────────────────
echo ""
echo "[0/4] Generating configs from platform.json..."
node "${SCRIPTS_DIR}/generate.js"

# Source generated shell variables (orderer ports, etc.)
# shellcheck source=../config/platform.sh
source "${NETWORK_DIR}/config/platform.sh"

# ── Wipe any leftover CA data (files may be root-owned, use Docker to delete) ─
if [ -d "${NETWORK_DIR}/organizations" ]; then
  docker run --rm -v "${NETWORK_DIR}/organizations":/data alpine \
    sh -c "rm -rf /data/fabric-ca /data/ordererOrganizations /data/peerOrganizations" 2>/dev/null || true
fi

# ── Pre-create orderer fabric-ca dir before Docker touches it ─────────────────
mkdir -p "${NETWORK_DIR}/organizations/fabric-ca/orderer"
mkdir -p "${NETWORK_DIR}/ledger"

# ── 1. Start orderer CA ───────────────────────────────────────────────────────
echo ""
echo "[1/4] Starting orderer Certificate Authority..."
docker compose -f "${NETWORK_DIR}/docker/docker-compose-ca.yaml" up -d --force-recreate
echo "Waiting for orderer CA to initialise (8s)..."
sleep 8

# ── 2. Provision orderer org identity ─────────────────────────────────────────
echo ""
echo "[2/4] Provisioning orderer org identities..."
. "${SCRIPTS_DIR}/provisionOrg.sh"

provisionOrdererOrg \
  "${ORDERER_CA_PORT}" "${ORDERER_CA_NAME}" \
  "${ORDERER_HOST}"    "${ORDERER_DOMAIN}"

# ── 3. Start orderer node ─────────────────────────────────────────────────────
echo ""
echo "[3/4] Starting orderer node..."
docker compose -f "${NETWORK_DIR}/docker/docker-compose-network.yaml" up -d 2>&1 | grep -v "orphan"

# ── 4. Wait for orderer admin port to be ready ───────────────────────────────
echo ""
echo "[4/4] Waiting for orderer admin port (${ORDERER_ADMIN_PORT}) to be ready..."
for i in $(seq 1 40); do
  if timeout 1 bash -c "cat < /dev/null > /dev/tcp/localhost/${ORDERER_ADMIN_PORT}" 2>/dev/null; then
    echo "Orderer is ready (${i}s)."
    break
  fi
  if [ "${i}" -eq 40 ]; then
    echo "ERROR: Orderer did not become ready after 40s."
    echo "Check logs: docker logs ${ORDERER_HOST}.${ORDERER_DOMAIN}"
    exit 1
  fi
  sleep 1
done

echo ""
echo "================================================="
echo "  Orderer ready. Register orgs via API."
echo ""
echo "  Orderer gRPC : localhost:${ORDERER_PORT}"
echo "  Orderer admin: localhost:${ORDERER_ADMIN_PORT}"
echo ""
echo "  Next steps:"
echo "    cd backend && npm install && npm start"
echo "    cd frontend && npm install && npm run dev"
echo "================================================="
