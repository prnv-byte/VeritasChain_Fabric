#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="${NETWORK_DIR}/scripts"

echo "================================================="
echo "  VeritasChain Network — Starting Up"
echo "================================================="

# ── 0. Generate YAML configs from platform.json ───────────────────────────────
echo ""
echo "[0/5] Generating configs from platform.json..."
node ${SCRIPTS_DIR}/generate.js

# Source generated shell variables (org names, ports, channel defs, etc.)
# shellcheck source=../config/platform.sh
source ${NETWORK_DIR}/config/platform.sh

# ── Pre-create directories (must happen before Docker — prevents root ownership) ──
for FOLDER in "${ORGS[@]}"; do
  mkdir -p ${NETWORK_DIR}/organizations/fabric-ca/${FOLDER}
done
mkdir -p ${NETWORK_DIR}/organizations/fabric-ca/orderer
mkdir -p ${NETWORK_DIR}/ledger

# ── 1. Start CAs ─────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Starting Certificate Authorities..."
docker compose -f ${NETWORK_DIR}/docker/docker-compose-ca.yaml up -d
echo "Waiting for CAs to initialise..."
sleep 8

# ── 2. Provision all org identities ──────────────────────────────────────────
echo ""
echo "[2/5] Provisioning org identities..."
. ${SCRIPTS_DIR}/provisionOrg.sh

# Orderer org first
provisionOrdererOrg \
  "${ORDERER_CA_PORT}" "${ORDERER_CA_NAME}" \
  "${ORDERER_HOST}"    "${ORDERER_DOMAIN}"

# Each peer org — data comes from generated platform.sh variables
for FOLDER in "${ORGS[@]}"; do
  MSP_VAR="ORG_${FOLDER}_MSP";    MSP="${!MSP_VAR}"
  DOM_VAR="ORG_${FOLDER}_DOMAIN"; DOM="${!DOM_VAR}"
  CAN_VAR="ORG_${FOLDER}_CA_NAME"; CAN="${!CAN_VAR}"
  CAP_VAR="ORG_${FOLDER}_CA_PORT"; CAP="${!CAP_VAR}"
  PRS_VAR="ORG_${FOLDER}_PEERS";   PRS="${!PRS_VAR}"

  # Convert "peer0:7051:7052 peer1:9051:9052" → "peer0:7051 peer1:9051" (name:port only, ccPort dropped)
  PEERS_NAMEPORT=$(echo "${PRS}" | tr ' ' '\n' | awk -F: '{print $1":"$2}' | tr '\n' ' ')

  echo ""
  echo "  Provisioning org: ${FOLDER} (${MSP})"
  provisionPeerOrg "${FOLDER}" "${CAN}" "${CAP}" "${DOM}" "${MSP}" "${PEERS_NAMEPORT}"
done

# ── 3. Start orderer + peers ──────────────────────────────────────────────────
echo ""
echo "[3/5] Starting orderer and peer nodes..."
docker compose -f ${NETWORK_DIR}/docker/docker-compose-network.yaml up -d
echo "Waiting for nodes to start..."
sleep 6

# ── 4. Create channels ────────────────────────────────────────────────────────
echo ""
echo "[4/5] Creating channels..."
for CH_DEF in "${CHANNEL_DEFS[@]}"; do
  IFS=':' read -r CH_NAME MFG_MSP MFG_DOMAIN MFG_PEER MFG_PORT SPLR_MSP SPLR_DOMAIN SPLR_PEER SPLR_PORT <<< "${CH_DEF}"
  echo ""
  echo "  Creating channel: ${CH_NAME}"
  ${SCRIPTS_DIR}/createChannel.sh \
    "${CH_NAME}" \
    "${MFG_MSP}" "${MFG_DOMAIN}" "${MFG_PEER}" "${MFG_PORT}" \
    "${SPLR_MSP}" "${SPLR_DOMAIN}" "${SPLR_PEER}" "${SPLR_PORT}"
done

# ── 5. Deploy chaincode ───────────────────────────────────────────────────────
echo ""
echo "[5/5] Deploying chaincode to all channels..."
for CH_DEF in "${CHANNEL_DEFS[@]}"; do
  IFS=':' read -r CH_NAME MFG_MSP MFG_DOMAIN MFG_PEER MFG_PORT SPLR_MSP SPLR_DOMAIN SPLR_PEER SPLR_PORT <<< "${CH_DEF}"
  echo ""
  echo "  Deploying to channel: ${CH_NAME}"
  ${SCRIPTS_DIR}/deployChaincode.sh \
    "${CH_NAME}" \
    "${MFG_MSP}" "${MFG_DOMAIN}" "${MFG_PEER}" "${MFG_PORT}" \
    "${SPLR_MSP}" "${SPLR_DOMAIN}" "${SPLR_PEER}" "${SPLR_PORT}"
done

echo ""
echo "================================================="
echo "  VeritasChain Network is UP"
echo ""
for CH_DEF in "${CHANNEL_DEFS[@]}"; do
  CH_NAME="${CH_DEF%%:*}"
  echo "  Channel: ${CH_NAME}"
done
echo ""
echo "  Chaincode: ${CC_NAME} v${CC_VERSION}"
echo "  API:       cd api && npm install && npm start"
echo "================================================="
