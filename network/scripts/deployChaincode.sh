#!/bin/bash
set -e

# Universal chaincode deployment script.
# Works for ANY channel and org pair — no hardcoding.
# Usage:
#   ./deployChaincode.sh <channelName> \
#     <mfgMspId> <mfgDomain> <mfgPeerName> <mfgPeerPort> \
#     <splrMspId> <splrDomain> <splrPeerName> <splrPeerPort>

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export FABRIC_CFG_PATH=${NETWORK_DIR}/config

CHANNEL_NAME=$1
MFG_MSP=$2  MFG_DOMAIN=$3  MFG_PEER=$4  MFG_PORT=$5
SPLR_MSP=$6  SPLR_DOMAIN=$7  SPLR_PEER=$8  SPLR_PORT=$9

if [[ -z "$CHANNEL_NAME" || -z "$MFG_MSP" || -z "$SPLR_MSP" ]]; then
  echo "Usage: $0 <channelName> <mfgMsp> <mfgDomain> <mfgPeerName> <mfgPeerPort> <splrMsp> <splrDomain> <splrPeerName> <splrPeerPort>"
  exit 1
fi

# Read chaincode params from platform.json
CC_NAME=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['chaincode']['name'])")
CC_VERSION=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['chaincode']['version'])")
CC_SEQUENCE=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['chaincode']['sequence'])")
CC_PATH=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['chaincode']['path'])")
ORDERER_DOMAIN=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['domain'])")
ORDERER_HOST=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['orderer']['name'])")
ORDERER_PORT=$(python3 -c "import sys,json; p=json.load(open('${NETWORK_DIR}/config/platform.json')); print(p['orderer']['port'])")

ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/ca.crt
MFG_TLS=${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/peers/${MFG_PEER}.${MFG_DOMAIN}/tls/ca.crt
SPLR_TLS=${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/peers/${SPLR_PEER}.${SPLR_DOMAIN}/tls/ca.crt

PKG_FILE=${NETWORK_DIR}/channel-artifacts/${CC_NAME}.tar.gz

setMfgPeer() {
  export CORE_PEER_LOCALMSPID=${MFG_MSP}
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${MFG_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/users/Admin@${MFG_DOMAIN}/msp
  export CORE_PEER_ADDRESS=localhost:${MFG_PORT}
}
setSplrPeer() {
  export CORE_PEER_LOCALMSPID=${SPLR_MSP}
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${SPLR_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/users/Admin@${SPLR_DOMAIN}/msp
  export CORE_PEER_ADDRESS=localhost:${SPLR_PORT}
}

echo "[${CHANNEL_NAME}] Packaging ${CC_NAME}..."
setMfgPeer
# Only package once (reuse existing package for subsequent channels)
if [[ ! -f ${PKG_FILE} ]]; then
  peer lifecycle chaincode package ${PKG_FILE} \
    --path ${NETWORK_DIR}/${CC_PATH} \
    --lang golang \
    --label ${CC_NAME}_${CC_VERSION}
  echo "[${CHANNEL_NAME}] Package created."
else
  echo "[${CHANNEL_NAME}] Reusing existing package."
fi

echo "[${CHANNEL_NAME}] Installing on manufacturer peer..."
setMfgPeer
peer lifecycle chaincode install ${PKG_FILE}

echo "[${CHANNEL_NAME}] Installing on supplier peer..."
setSplrPeer
peer lifecycle chaincode install ${PKG_FILE}

echo "[${CHANNEL_NAME}] Querying package ID..."
setMfgPeer
CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled 2>&1 | grep "${CC_NAME}_${CC_VERSION}" | awk '{print $3}' | sed 's/,$//' | head -1)
echo "[${CHANNEL_NAME}] Package ID: ${CC_PACKAGE_ID}"

echo "[${CHANNEL_NAME}] Approving for manufacturer org (${MFG_MSP})..."
setMfgPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:${ORDERER_PORT} --ordererTLSHostnameOverride ${ORDERER_HOST}.${ORDERER_DOMAIN} \
  --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

echo "[${CHANNEL_NAME}] Approving for supplier org (${SPLR_MSP})..."
setSplrPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:${ORDERER_PORT} --ordererTLSHostnameOverride ${ORDERER_HOST}.${ORDERER_DOMAIN} \
  --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

echo "[${CHANNEL_NAME}] Committing chaincode..."
peer lifecycle chaincode commit \
  -o localhost:${ORDERER_PORT} --ordererTLSHostnameOverride ${ORDERER_HOST}.${ORDERER_DOMAIN} \
  --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} \
  --peerAddresses localhost:${MFG_PORT} --tlsRootCertFiles ${MFG_TLS} \
  --peerAddresses localhost:${SPLR_PORT} --tlsRootCertFiles ${SPLR_TLS} \
  --tls --cafile ${ORDERER_CA}

echo "[${CHANNEL_NAME}] ${CC_NAME} deployed."
