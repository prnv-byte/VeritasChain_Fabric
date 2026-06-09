#!/bin/bash
set -e

# VeritasChain Admin — Remove a malicious or fraudulent org from the network.
#
# This script performs a full 3-phase eviction:
#   Phase 1 — Remove org MSP from all its channels (channel config update)
#   Phase 2 — Revoke org certificates via its CA
#   Phase 3 — Stop and remove org Docker containers + crypto files
#
# Usage:
#   ./removeOrg.sh <orgMspId> <orgDomain> <orgFolderName> <channelName> \
#                  <remainingMspId> <remainingDomain> <remainingPeerName> <remainingPeerPort> \
#                  <ordererHostname> <ordererPort> <ordererAdminPort>
#
# Example:
#   ./removeOrg.sh BatteryOrg8364MSP batteryorg8364.veritaschain.com batteryorg8364 \
#                  ch-voltrideorg-batteryorg \
#                  VoltRideOrg9eb7MSP voltrideor9eb7.veritaschain.com peer0 7051 \
#                  orderer-ch-voltrideorg-batteryorg.veritaschain.com 8050 8053
#
# NOTE: The remaining org admin must be available to co-sign the config update.
#       Both orgs must approve channel config changes in Hyperledger Fabric.

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="veritaschain.com"

# ── Args ──────────────────────────────────────────────────────────────────────
ORG_MSP=$1        # MSP ID of org to remove     e.g. BatteryOrg8364MSP
ORG_DOMAIN=$2     # domain of org to remove     e.g. batteryorg8364.veritaschain.com
ORG_FOLDER=$3     # folder name of org          e.g. batteryorg8364
CHANNEL_NAME=$4   # channel to remove them from e.g. ch-voltrideorg-batteryorg

REM_MSP=$5        # remaining org MSP ID        e.g. VoltRideOrg9eb7MSP
REM_DOMAIN=$6     # remaining org domain        e.g. voltrideor9eb7.veritaschain.com
REM_PEER=$7       # remaining org peer name     e.g. peer0
REM_PORT=$8       # remaining org peer port     e.g. 7051

ORDERER_HOST=${9}         # e.g. orderer-ch-voltrideorg-batteryorg.veritaschain.com
ORDERER_PORT=${10}        # e.g. 8050
ORDERER_ADMIN_PORT=${11}  # e.g. 8053

if [[ -z "$ORG_MSP" || -z "$ORG_DOMAIN" || -z "$ORG_FOLDER" || -z "$CHANNEL_NAME" || \
      -z "$REM_MSP" || -z "$REM_DOMAIN" || -z "$ORDERER_HOST" ]]; then
  echo "Usage: $0 <orgMspId> <orgDomain> <orgFolderName> <channelName> \\"
  echo "          <remainingMspId> <remainingDomain> <remainingPeerName> <remainingPeerPort> \\"
  echo "          <ordererHostname> <ordererPort> <ordererAdminPort>"
  exit 1
fi

ORDERER_CA="${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN}/orderers/${ORDERER_HOST}/tls/ca.crt"
ORDERER_SIGN_CERT="${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN}/orderers/${ORDERER_HOST}/tls/server.crt"
ORDERER_KEY="${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN}/orderers/${ORDERER_HOST}/tls/server.key"

REM_TLS="${NETWORK_DIR}/organizations/peerOrganizations/${REM_DOMAIN}/peers/${REM_PEER}.${REM_DOMAIN}/tls/ca.crt"
REM_MSP_PATH="${NETWORK_DIR}/organizations/peerOrganizations/${REM_DOMAIN}/users/Admin@${REM_DOMAIN}/msp"

WORK_DIR="/tmp/removeorg-${ORG_FOLDER}-$(date +%s)"
mkdir -p "${WORK_DIR}"

export FABRIC_CFG_PATH="${NETWORK_DIR}/config"

echo "================================================="
echo "  VeritasChain — Removing org: ${ORG_MSP}"
echo "  Channel: ${CHANNEL_NAME}"
echo "================================================="

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1: Remove org MSP from channel config
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[Phase 1] Updating channel config to remove ${ORG_MSP}..."

# Set peer env to remaining org so we can fetch config
export CORE_PEER_LOCALMSPID="${REM_MSP}"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE="${REM_TLS}"
export CORE_PEER_MSPCONFIGPATH="${REM_MSP_PATH}"
export CORE_PEER_ADDRESS="localhost:${REM_PORT}"

echo "  [1/6] Fetching current channel config block..."
peer channel fetch config "${WORK_DIR}/config_block.pb" \
  -o "localhost:${ORDERER_PORT}" \
  -c "${CHANNEL_NAME}" \
  --tls --cafile "${ORDERER_CA}"

echo "  [2/6] Decoding config block to JSON..."
configtxlator proto_decode \
  --input "${WORK_DIR}/config_block.pb" \
  --type common.Block \
  | jq .data.data[0].payload.data.config > "${WORK_DIR}/config.json"

echo "  [3/6] Removing ${ORG_MSP} from channel config..."
jq "del(.channel_group.groups.Application.groups.\"${ORG_MSP}\")" \
  "${WORK_DIR}/config.json" > "${WORK_DIR}/modified_config.json"

echo "  [4/6] Computing config delta..."
configtxlator proto_encode \
  --input "${WORK_DIR}/config.json" \
  --type common.Config \
  --output "${WORK_DIR}/original.pb"

configtxlator proto_encode \
  --input "${WORK_DIR}/modified_config.json" \
  --type common.Config \
  --output "${WORK_DIR}/modified.pb"

configtxlator compute_update \
  --channel_id "${CHANNEL_NAME}" \
  --original "${WORK_DIR}/original.pb" \
  --updated "${WORK_DIR}/modified.pb" \
  --output "${WORK_DIR}/config_update.pb"

echo "  [5/6] Wrapping config update in envelope..."
echo '{"payload":{"header":{"channel_header":{"channel_id":"'"${CHANNEL_NAME}"'","type":2}},"data":{"config_update":'$(configtxlator proto_decode --input "${WORK_DIR}/config_update.pb" --type common.ConfigUpdate)'}}}' \
  | jq . > "${WORK_DIR}/config_update_envelope.json"

configtxlator proto_encode \
  --input "${WORK_DIR}/config_update_envelope.json" \
  --type common.Envelope \
  --output "${WORK_DIR}/config_update_envelope.pb"

echo "  [6/6] Signing and submitting channel update (as remaining org admin)..."
peer channel signconfigtx -f "${WORK_DIR}/config_update_envelope.pb"

peer channel update \
  -f "${WORK_DIR}/config_update_envelope.pb" \
  -c "${CHANNEL_NAME}" \
  -o "localhost:${ORDERER_PORT}" \
  --tls --cafile "${ORDERER_CA}"

echo "[Phase 1] Done — ${ORG_MSP} removed from channel ${CHANNEL_NAME}."

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2: Revoke org certificates via its CA
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[Phase 2] Revoking certificates for ${ORG_FOLDER}..."

ORG_CA_DIR="${NETWORK_DIR}/organizations/fabric-ca/${ORG_FOLDER}"
ORG_CA_TLS="${ORG_CA_DIR}/tls-cert.pem"
ORG_PEER_DIR="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}"

if [ -f "${ORG_CA_TLS}" ]; then
  export FABRIC_CA_CLIENT_HOME="${ORG_PEER_DIR}"

  # Revoke the org admin identity
  set +e
  fabric-ca-client revoke \
    -e "${ORG_FOLDER}admin" \
    -r "keycompromise" \
    --caname "ca-${ORG_FOLDER}" \
    --tls.certfiles "${ORG_CA_TLS}" 2>/dev/null
  set -e

  # Revoke the peer identity
  set +e
  fabric-ca-client revoke \
    -e "peer0" \
    -r "keycompromise" \
    --caname "ca-${ORG_FOLDER}" \
    --tls.certfiles "${ORG_CA_TLS}" 2>/dev/null
  set -e

  echo "[Phase 2] Done — certificates revoked."
else
  echo "[Phase 2] Skipped — CA TLS cert not found (org may already be partially removed)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3: Stop containers and remove crypto files
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[Phase 3] Stopping Docker containers for ${ORG_FOLDER}..."

# Stop peer container
docker rm -f "peer0.${ORG_DOMAIN}" 2>/dev/null \
  && echo "  Stopped peer0.${ORG_DOMAIN}" \
  || echo "  peer0.${ORG_DOMAIN} not running (already stopped)"

# Stop CA container
docker rm -f "ca-${ORG_FOLDER}" 2>/dev/null \
  && echo "  Stopped ca-${ORG_FOLDER}" \
  || echo "  ca-${ORG_FOLDER} not running (already stopped)"

# Remove crypto materials (use Docker helper for root-owned files)
echo "  Removing crypto materials..."
docker run --rm \
  -v "${NETWORK_DIR}/organizations":/orgs \
  alpine sh -c "
    rm -rf /orgs/peerOrganizations/${ORG_DOMAIN}
    rm -rf /orgs/fabric-ca/${ORG_FOLDER}
  " 2>/dev/null || true

# Remove ledger data
echo "  Removing ledger data..."
docker run --rm \
  -v "${NETWORK_DIR}/ledger":/ledger \
  alpine sh -c "rm -rf /ledger/peer0.${ORG_DOMAIN}" 2>/dev/null || true

echo "[Phase 3] Done — containers stopped, files removed."

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup temp files
# ─────────────────────────────────────────────────────────────────────────────
rm -rf "${WORK_DIR}"

echo ""
echo "================================================="
echo "  Org ${ORG_MSP} fully evicted from VeritasChain."
echo ""
echo "  Next step: Call the backend admin API to set"
echo "  fabricStatus = 'banned' in MongoDB so the org"
echo "  cannot log back into the platform."
echo "================================================="
