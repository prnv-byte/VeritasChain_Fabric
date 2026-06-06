#!/bin/bash

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping VeritasChain network..."

docker compose -f ${NETWORK_DIR}/docker/docker-compose-network.yaml down --volumes --remove-orphans 2>/dev/null || true
docker compose -f ${NETWORK_DIR}/docker/docker-compose-ca.yaml down --volumes --remove-orphans 2>/dev/null || true

# Remove chaincode containers
docker rm -f $(docker ps -aq --filter "name=dev-peer*") 2>/dev/null || true

echo "Network stopped."
