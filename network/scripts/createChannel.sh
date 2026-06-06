#!/bin/bash
set -e

# Universal channel creation script.
# Works for ANY two orgs — no hardcoding.
# Usage:
#   ./createChannel.sh <channelName> \
#     <mfgMspId> <mfgDomain> <mfgPeerName> <mfgPeerPort> \
#     <splrMspId> <splrDomain> <splrPeerName> <splrPeerPort>

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CHANNEL_NAME=$1
MFG_MSP=$2  MFG_DOMAIN=$3  MFG_PEER=$4  MFG_PORT=$5
SPLR_MSP=$6  SPLR_DOMAIN=$7  SPLR_PEER=$8  SPLR_PORT=$9

if [[ -z "$CHANNEL_NAME" || -z "$MFG_MSP" || -z "$SPLR_MSP" ]]; then
  echo "Usage: $0 <channelName> <mfgMsp> <mfgDomain> <mfgPeerName> <mfgPeerPort> <splrMsp> <splrDomain> <splrPeerName> <splrPeerPort>"
  exit 1
fi

# Profile name: voltride-battery → VoltrideBattery
PROFILE=$(python3 -c "s='${CHANNEL_NAME}'; print(''.join(w.capitalize() for w in s.split('-')))")
# Org anchor names: VoltRideMSP → VoltRideOrg
MFG_ORG="${MFG_MSP%MSP}Org"
SPLR_ORG="${SPLR_MSP%MSP}Org"

ORDERER_DOMAIN=$(cat ${NETWORK_DIR}/config/platform.json | python3 -c "import sys,json; p=json.load(sys.stdin); print(p['domain'])")
ORDERER_HOST=$(cat ${NETWORK_DIR}/config/platform.json   | python3 -c "import sys,json; p=json.load(sys.stdin); print(p['orderer']['name'])")
ORDERER_ADMIN_PORT=$(cat ${NETWORK_DIR}/config/platform.json | python3 -c "import sys,json; p=json.load(sys.stdin); print(p['orderer']['adminPort'])")
ORDERER_PORT=$(cat ${NETWORK_DIR}/config/platform.json   | python3 -c "import sys,json; p=json.load(sys.stdin); print(p['orderer']['port'])")

ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/ca.crt
ORDERER_SIGN_CERT=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/server.crt
ORDERER_KEY=${NETWORK_DIR}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/${ORDERER_HOST}.${ORDERER_DOMAIN}/tls/server.key

MFG_TLS=${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/peers/${MFG_PEER}.${MFG_DOMAIN}/tls/ca.crt
SPLR_TLS=${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/peers/${SPLR_PEER}.${SPLR_DOMAIN}/tls/ca.crt

mkdir -p ${NETWORK_DIR}/channel-artifacts

echo "[${CHANNEL_NAME}] Generating genesis block (profile: ${PROFILE})..."
export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile ${PROFILE} \
  -outputBlock ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block \
  -channelID ${CHANNEL_NAME}

echo "[${CHANNEL_NAME}] Joining orderer..."
osnadmin channel join \
  --channelID ${CHANNEL_NAME} \
  --config-block ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block \
  -o localhost:${ORDERER_ADMIN_PORT} \
  --ca-file ${ORDERER_CA} \
  --client-cert ${ORDERER_SIGN_CERT} \
  --client-key ${ORDERER_KEY}
sleep 2

export FABRIC_CFG_PATH=${NETWORK_DIR}/config

echo "[${CHANNEL_NAME}] Joining manufacturer peer (${MFG_PEER}.${MFG_DOMAIN}:${MFG_PORT})..."
export CORE_PEER_LOCALMSPID=${MFG_MSP}
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=${MFG_TLS}
export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/users/Admin@${MFG_DOMAIN}/msp
export CORE_PEER_ADDRESS=localhost:${MFG_PORT}
peer channel join -b ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block \
  --tls --cafile ${ORDERER_CA}

echo "[${CHANNEL_NAME}] Joining supplier peer (${SPLR_PEER}.${SPLR_DOMAIN}:${SPLR_PORT})..."
export CORE_PEER_LOCALMSPID=${SPLR_MSP}
export CORE_PEER_TLS_ROOTCERT_FILE=${SPLR_TLS}
export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/users/Admin@${SPLR_DOMAIN}/msp
export CORE_PEER_ADDRESS=localhost:${SPLR_PORT}
peer channel join -b ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block \
  --tls --cafile ${ORDERER_CA}

echo "[${CHANNEL_NAME}] Setting anchor peers..."
export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx

configtxgen -profile ${PROFILE} \
  -outputAnchorPeersUpdate ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}_mfg_anchors.tx \
  -channelID ${CHANNEL_NAME} -asOrg ${MFG_ORG}
configtxgen -profile ${PROFILE} \
  -outputAnchorPeersUpdate ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}_splr_anchors.tx \
  -channelID ${CHANNEL_NAME} -asOrg ${SPLR_ORG}

export FABRIC_CFG_PATH=${NETWORK_DIR}/config

export CORE_PEER_LOCALMSPID=${MFG_MSP}
export CORE_PEER_TLS_ROOTCERT_FILE=${MFG_TLS}
export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${MFG_DOMAIN}/users/Admin@${MFG_DOMAIN}/msp
export CORE_PEER_ADDRESS=localhost:${MFG_PORT}
peer channel update -o localhost:${ORDERER_PORT} -c ${CHANNEL_NAME} \
  -f ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}_mfg_anchors.tx \
  --tls --cafile ${ORDERER_CA}

export CORE_PEER_LOCALMSPID=${SPLR_MSP}
export CORE_PEER_TLS_ROOTCERT_FILE=${SPLR_TLS}
export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${SPLR_DOMAIN}/users/Admin@${SPLR_DOMAIN}/msp
export CORE_PEER_ADDRESS=localhost:${SPLR_PORT}
peer channel update -o localhost:${ORDERER_PORT} -c ${CHANNEL_NAME} \
  -f ${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}_splr_anchors.tx \
  --tls --cafile ${ORDERER_CA}

echo "[${CHANNEL_NAME}] Channel ready."
