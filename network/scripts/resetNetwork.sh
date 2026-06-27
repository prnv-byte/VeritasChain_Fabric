#!/bin/bash

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "!!! Resetting VeritasChain network — all data will be wiped !!!"

# Stop and remove compose-managed containers (orderer + orderer CA)
docker compose -f "${NETWORK_DIR}/docker/docker-compose-network.yaml" down --volumes --remove-orphans 2>/dev/null || true
docker compose -f "${NETWORK_DIR}/docker/docker-compose-ca.yaml" down --volumes --remove-orphans 2>/dev/null || true

# Stop and remove any dynamically-started org containers (peers + org CAs)
# These match the pattern *.veritaschain.com (e.g. peer0.voltride.veritaschain.com, ca-voltride)
DYNAMIC_CONTAINERS=$(docker ps -aq --filter "name=.veritaschain.com" 2>/dev/null || true)
if [ -n "${DYNAMIC_CONTAINERS}" ]; then
  echo "Stopping dynamic org containers..."
  docker rm -f ${DYNAMIC_CONTAINERS} 2>/dev/null || true
fi

# Also stop org CA containers (named ca-<orgname> pattern)
DYNAMIC_CA_CONTAINERS=$(docker ps -aq --filter "name=ca-" 2>/dev/null | xargs -r docker inspect --format '{{.Name}}' 2>/dev/null | grep -v "ca-orderer" | xargs -r docker rm -f 2>/dev/null || true)

# Remove any chaincode containers (dev-peer* pattern)
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true

# Wipe runtime data — use Docker helper container (avoids sudo for root-owned files)
if [ -d "${NETWORK_DIR}/organizations" ] || [ -d "${NETWORK_DIR}/ledger" ]; then
  docker run --rm \
    -v "${NETWORK_DIR}/organizations":/orgs \
    -v "${NETWORK_DIR}/ledger":/ledger \
    alpine sh -c "rm -rf /orgs/* /ledger/*" 2>/dev/null || true
  rm -rf "${NETWORK_DIR}/organizations" "${NETWORK_DIR}/ledger"
fi
rm -rf "${NETWORK_DIR}/channel-artifacts"

# Wipe all generated ZK keys from the backend
BACKEND_KEYS="${NETWORK_DIR}/../backend/keys"
if [ -d "${BACKEND_KEYS}" ]; then
  echo "Wiping backend ZK keys..."
  rm -rf "${BACKEND_KEYS}"
fi

# Wipe all supplier proof files
BACKEND_PROOFS="${NETWORK_DIR}/../backend/proofs"
if [ -d "${BACKEND_PROOFS}" ]; then
  echo "Wiping supplier proof files..."
  rm -rf "${BACKEND_PROOFS}"
  mkdir -p "${BACKEND_PROOFS}"
fi

# Clean up any temp configtx dirs
rm -rf /tmp/configtx-*

echo "Network reset complete."
echo "Run: ./scripts/startNetwork.sh"
