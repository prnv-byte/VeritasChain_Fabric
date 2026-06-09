#!/bin/bash

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping VeritasChain network..."

# Stop compose-managed orderer + orderer CA
docker compose -f ${NETWORK_DIR}/docker/docker-compose-network.yaml down --volumes --remove-orphans 2>/dev/null || true
docker compose -f ${NETWORK_DIR}/docker/docker-compose-ca.yaml down --volumes --remove-orphans 2>/dev/null || true

# Stop dynamic org containers (peers + org CAs registered via API)
DYNAMIC=$(docker ps -aq --filter "name=.veritaschain.com" 2>/dev/null)
if [ -n "${DYNAMIC}" ]; then
  echo "Stopping dynamic org containers..."
  docker rm -f ${DYNAMIC} 2>/dev/null || true
fi

# Stop per-channel orderer containers
CHANNEL_ORDERERS=$(docker ps -aq --filter "name=orderer-ch-" 2>/dev/null)
if [ -n "${CHANNEL_ORDERERS}" ]; then
  echo "Stopping per-channel orderer containers..."
  docker rm -f ${CHANNEL_ORDERERS} 2>/dev/null || true
fi

# Stop org CA containers (ca-<orgname> pattern, excluding ca-orderer)
CA_CONTAINERS=$(docker ps -aq --filter "name=ca-" 2>/dev/null | xargs -r docker inspect --format '{{.Name}}' 2>/dev/null | grep -v "ca-orderer" | sed 's|/||' | xargs -r docker rm -f 2>/dev/null || true)

# Remove chaincode containers
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true

echo "Network stopped."
