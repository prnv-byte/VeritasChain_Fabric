#!/bin/bash
set -e

# Universal channel creation script.
# Works for ANY two orgs — no hardcoding.
# Usage:
#   ./createChannel.sh <channelName> \
#     <mfgMspId> <mfgDomain> <mfgPeerName> <mfgPeerPort> \
#     <splrMspId> <splrDomain> <splrPeerName> <splrPeerPort> \
#     <configtxDir>
#
# <configtxDir> — directory containing the per-channel configtx.yaml for configtxgen.
#                 configtxgen uses this dir; peer commands use network/config.

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CHANNEL_NAME=$1
MFG_MSP=$2  MFG_DOMAIN=$3  MFG_PEER=$4  MFG_PORT=$5
SPLR_MSP=$6  SPLR_DOMAIN=$7  SPLR_PEER=$8  SPLR_PORT=$9
CONFIGTX_DIR=${10}

if [[ -z "$CHANNEL_NAME" || -z "$MFG_MSP" || -z "$SPLR_MSP" || -z "$CONFIGTX_DIR" ]]; then
  echo "Usage: $0 <channelName> <mfgMsp> <mfgDomain> <mfgPeerName> <mfgPeerPort> <splrMsp> <splrDomain> <splrPeerName> <splrPeerPort> <configtxDir>"
  exit 1
fi

# Profile name: ch-voltride-battery → ChVoltrideB attery (all segments capitalized, dashes removed)
PROFILE=$(python3 -c "s='${CHANNEL_NAME}'; print(''.join(w.capitalize() for w in s.split('-')))")

ORDERER_DOMAIN=$(python3 -c "import json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['domain'])")
ORDERER_HOST=$(python3 -c "import json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['orderer']['name'])")
ORDERER_ADMIN_PORT=$(python3 -c "import json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['orderer']['adminPort'])")
ORDERER_PORT=$(python3 -c "import json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['orderer']['port'])")

ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/ca.crt
ORDERER_SIGN_CERT=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/server.crt
ORDERER_KEY=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/server.key

MFG_TLS=${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/peers/${MFG_PEER}.${MFG_DOMAIN}/tls/ca.crt
SPLR_TLS=${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/peers/${SPLR_PEER}.${SPLR_DOMAIN}/tls/ca.crt

mkdir -p "${NETWORK_DIR}/channel-artifacts"

echo "[${CHANNEL_NAME}] Generating genesis block (profile: ${PROFILE})..."
# Use the per-channel configtx dir for configtxgen
export FABRIC_CFG_PATH="${CONFIGTX_DIR}"
configtxgen -profile "${PROFILE}" \
  -outputBlock "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
  -channelID "${CHANNEL_NAME}"

echo "[${CHANNEL_NAME}] Joining orderer..."
JOINED=false
for attempt in $(seq 1 10); do
  set +e
  osnadmin channel join \
    --channelID "${CHANNEL_NAME}" \
    --config-block "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
    -o "localhost:${ORDERER_ADMIN_PORT}" \
    --ca-file "${ORDERER_CA}" \
    --client-cert "${ORDERER_SIGN_CERT}" \
    --client-key "${ORDERER_KEY}" > /tmp/osnadmin_out.txt 2>&1
  OSNADMIN_RC=$?
  set -e
  cat /tmp/osnadmin_out.txt
  if grep -qE "Status: 20[0-9]" /tmp/osnadmin_out.txt || grep -q "already exists" /tmp/osnadmin_out.txt; then
    JOINED=true
    break
  fi
  echo "  osnadmin attempt ${attempt}/10 failed, retrying in 3s..."
  sleep 3
done
if [ "$JOINED" != "true" ]; then
  echo "ERROR: Orderer join failed after 10 attempts for channel ${CHANNEL_NAME}"
  exit 1
fi
sleep 2

# Switch to network/config for peer CLI commands
export FABRIC_CFG_PATH="${NETWORK_DIR}/config"

echo "[${CHANNEL_NAME}] Joining manufacturer peer (${MFG_PEER}.${MFG_DOMAIN}:${MFG_PORT})..."
export CORE_PEER_LOCALMSPID="${MFG_MSP}"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE="${MFG_TLS}"
export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/users/Admin@${MFG_DOMAIN}/msp"
export CORE_PEER_ADDRESS="localhost:${MFG_PORT}"
peer channel join -b "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
  --tls --cafile "${ORDERER_CA}"

echo "[${CHANNEL_NAME}] Joining supplier peer (${SPLR_PEER}.${SPLR_DOMAIN}:${SPLR_PORT})..."
export CORE_PEER_LOCALMSPID="${SPLR_MSP}"
export CORE_PEER_TLS_ROOTCERT_FILE="${SPLR_TLS}"
export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/users/Admin@${SPLR_DOMAIN}/msp"
export CORE_PEER_ADDRESS="localhost:${SPLR_PORT}"
peer channel join -b "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
  --tls --cafile "${ORDERER_CA}"

echo "[${CHANNEL_NAME}] Channel ready."
