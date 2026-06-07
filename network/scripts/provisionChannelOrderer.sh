#!/bin/bash
set -e

# Provisions a dedicated Raft orderer for a single channel.
# Enrolls a new orderer identity from the existing orderer CA (ca-orderer, port 11054)
# and starts a Docker container for it on the veritaschain network.
#
# Usage:
#   ./provisionChannelOrderer.sh <ordererName> <ordererPort> <ordererAdminPort>
# Example:
#   ./provisionChannelOrderer.sh orderer-ch-tatamotors-exide 8050 8053

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="veritaschain.com"

ORDERER_NAME=$1
ORDERER_PORT=$2
ORDERER_ADMIN_PORT=$3

if [[ -z "$ORDERER_NAME" || -z "$ORDERER_PORT" || -z "$ORDERER_ADMIN_PORT" ]]; then
  echo "Usage: $0 <ordererName> <ordererPort> <ordererAdminPort>"
  exit 1
fi

ORDERER_HOST="${ORDERER_NAME}.${DOMAIN}"
CA_PORT=11054
CA_NAME="ca-orderer"
CA_TLS="${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem"
ORG_DIR="${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN}"
ORDERER_DIR="${ORG_DIR}/orderers/${ORDERER_HOST}"

# ── Enroll identity from existing orderer CA ──────────────────────────────────
echo "[${ORDERER_NAME}] Registering identity with orderer CA..."
export FABRIC_CA_CLIENT_HOME="${ORG_DIR}"

set +e
OUT=$(fabric-ca-client register --caname "${CA_NAME}" \
  --id.name "${ORDERER_NAME}" --id.secret "${ORDERER_NAME}pw" --id.type orderer \
  --tls.certfiles "${CA_TLS}" 2>&1)
RC=$?
set -e
echo "$OUT"
if [ $RC -ne 0 ] && ! echo "$OUT" | grep -q "already registered"; then
  echo "ERROR: failed to register orderer identity ${ORDERER_NAME}"
  exit 1
fi

echo "[${ORDERER_NAME}] Enrolling MSP cert..."
mkdir -p "${ORDERER_DIR}"
fabric-ca-client enroll \
  -u "https://${ORDERER_NAME}:${ORDERER_NAME}pw@localhost:${CA_PORT}" \
  --caname "${CA_NAME}" \
  -M "${ORDERER_DIR}/msp" \
  --csr.hosts "${ORDERER_HOST}" --csr.hosts localhost \
  --tls.certfiles "${CA_TLS}"
cp "${ORG_DIR}/msp/config.yaml" "${ORDERER_DIR}/msp/config.yaml"

echo "[${ORDERER_NAME}] Enrolling TLS cert..."
fabric-ca-client enroll \
  -u "https://${ORDERER_NAME}:${ORDERER_NAME}pw@localhost:${CA_PORT}" \
  --caname "${CA_NAME}" \
  -M "${ORDERER_DIR}/tls" \
  --enrollment.profile tls \
  --csr.hosts "${ORDERER_HOST}" --csr.hosts localhost \
  --tls.certfiles "${CA_TLS}"

cp "${ORDERER_DIR}/tls/tlscacerts/"* "${ORDERER_DIR}/tls/ca.crt"
cp "${ORDERER_DIR}/tls/signcerts/"*   "${ORDERER_DIR}/tls/server.crt"
cp "${ORDERER_DIR}/tls/keystore/"*_sk "${ORDERER_DIR}/tls/server.key"

# ── Start Docker container ────────────────────────────────────────────────────
echo "[${ORDERER_NAME}] Starting Docker container on port ${ORDERER_PORT} (admin: ${ORDERER_ADMIN_PORT})..."
LEDGER_DIR="${NETWORK_DIR}/ledger/${ORDERER_HOST}"
mkdir -p "${LEDGER_DIR}"

docker rm -f "${ORDERER_HOST}" 2>/dev/null || true

docker run -d \
  --name "${ORDERER_HOST}" \
  --hostname "${ORDERER_HOST}" \
  --network veritaschain \
  -e FABRIC_LOGGING_SPEC=INFO \
  -e ORDERER_GENERAL_LISTENADDRESS=0.0.0.0 \
  -e "ORDERER_GENERAL_LISTENPORT=${ORDERER_PORT}" \
  -e ORDERER_GENERAL_LOCALMSPID=OrdererMSP \
  -e ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp \
  -e ORDERER_GENERAL_TLS_ENABLED=true \
  -e ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key \
  -e ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt \
  -e "ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]" \
  -e ORDERER_GENERAL_BOOTSTRAPMETHOD=none \
  -e ORDERER_CHANNELPARTICIPATION_ENABLED=true \
  -e ORDERER_ADMIN_TLS_ENABLED=true \
  -e ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt \
  -e ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key \
  -e "ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]" \
  -e ORDERER_ADMIN_TLS_CLIENTAUTHREQUIRED=true \
  -e "ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]" \
  -e "ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:${ORDERER_ADMIN_PORT}" \
  -p "${ORDERER_PORT}:${ORDERER_PORT}" \
  -p "${ORDERER_ADMIN_PORT}:${ORDERER_ADMIN_PORT}" \
  -v "${ORDERER_DIR}/msp:/var/hyperledger/orderer/msp" \
  -v "${ORDERER_DIR}/tls:/var/hyperledger/orderer/tls" \
  -v "${LEDGER_DIR}:/var/hyperledger/production" \
  hyperledger/fabric-orderer:2.5 orderer

echo "[${ORDERER_NAME}] Orderer running at ${ORDERER_HOST}:${ORDERER_PORT}."
