#!/bin/bash

# Universal org provisioning functions.
# Source this file; call provisionPeerOrg or provisionOrdererOrg.
# NETWORK_DIR must be exported by the calling script.
#
# To add a NEW org to the platform:
#   1. Add it to network/config/platform.json
#   2. Run: node scripts/generate.js
#   3. Run: provisionPeerOrg <params>  (or re-run startNetwork.sh)

# ── provisionPeerOrg ──────────────────────────────────────────────────────────
# Usage: provisionPeerOrg <folderName> <caName> <caPort> <domain> <mspId> "<peer1:port1> <peer2:port2> ..."
# Example: provisionPeerOrg battery ca-battery 8054 battery.veritaschain.com BatteryMSP "peer0:7051"
function provisionPeerOrg() {
  local FOLDER=$1 CA_NAME=$2 CA_PORT=$3 DOMAIN=$4 MSP_ID=$5 PEERS_STR=$6

  local ORG_DIR=${NETWORK_DIR}/organizations/peerOrganizations/${DOMAIN}
  local CA_TLS=${NETWORK_DIR}/organizations/fabric-ca/${FOLDER}/tls-cert.pem
  local CA_CERT_FILE="localhost-${CA_PORT}-${CA_NAME}.pem"
  local ADMIN_ID="${FOLDER}admin"

  echo "  [${DOMAIN}] Enrolling CA admin..."
  mkdir -p ${ORG_DIR}
  export FABRIC_CA_CLIENT_HOME=${ORG_DIR}

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    --tls.certfiles ${CA_TLS}

  # MSP config.yaml — tells Fabric how to map OU fields in certs
  cat > ${ORG_DIR}/msp/config.yaml <<NODEOUS
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: orderer
NODEOUS

  echo "  [${DOMAIN}] Registering identities..."
  read -ra PEER_DEFS <<< "${PEERS_STR}"
  for PEER_DEF in "${PEER_DEFS[@]}"; do
    local PEER_NAME="${PEER_DEF%%:*}"
    fabric-ca-client register --caname ${CA_NAME} \
      --id.name ${PEER_NAME} --id.secret ${PEER_NAME}pw --id.type peer \
      --tls.certfiles ${CA_TLS}
  done

  fabric-ca-client register --caname ${CA_NAME} \
    --id.name user1 --id.secret user1pw --id.type client \
    --tls.certfiles ${CA_TLS}

  fabric-ca-client register --caname ${CA_NAME} \
    --id.name ${ADMIN_ID} --id.secret ${ADMIN_ID}pw --id.type admin \
    --tls.certfiles ${CA_TLS}

  echo "  [${DOMAIN}] Enrolling peers (MSP + TLS)..."
  for PEER_DEF in "${PEER_DEFS[@]}"; do
    local PEER_NAME="${PEER_DEF%%:*}"
    local PEER_DIR=${ORG_DIR}/peers/${PEER_NAME}.${DOMAIN}
    mkdir -p ${PEER_DIR}

    # MSP
    fabric-ca-client enroll \
      -u https://${PEER_NAME}:${PEER_NAME}pw@localhost:${CA_PORT} \
      --caname ${CA_NAME} \
      -M ${PEER_DIR}/msp \
      --csr.hosts ${PEER_NAME}.${DOMAIN} \
      --tls.certfiles ${CA_TLS}
    cp ${ORG_DIR}/msp/config.yaml ${PEER_DIR}/msp/config.yaml

    # TLS
    fabric-ca-client enroll \
      -u https://${PEER_NAME}:${PEER_NAME}pw@localhost:${CA_PORT} \
      --caname ${CA_NAME} \
      -M ${PEER_DIR}/tls \
      --enrollment.profile tls \
      --csr.hosts ${PEER_NAME}.${DOMAIN} --csr.hosts localhost \
      --tls.certfiles ${CA_TLS}

    cp ${PEER_DIR}/tls/tlscacerts/* ${PEER_DIR}/tls/ca.crt
    cp ${PEER_DIR}/tls/signcerts/*  ${PEER_DIR}/tls/server.crt
    cp ${PEER_DIR}/tls/keystore/*_sk ${PEER_DIR}/tls/server.key
  done

  echo "  [${DOMAIN}] Enrolling admin and user identities..."
  local USER_DIR=${ORG_DIR}/users/User1@${DOMAIN}
  local ADMN_DIR=${ORG_DIR}/users/Admin@${DOMAIN}

  fabric-ca-client enroll \
    -u https://user1:user1pw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    -M ${USER_DIR}/msp \
    --tls.certfiles ${CA_TLS}
  cp ${ORG_DIR}/msp/config.yaml ${USER_DIR}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://${ADMIN_ID}:${ADMIN_ID}pw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    -M ${ADMN_DIR}/msp \
    --tls.certfiles ${CA_TLS}
  cp ${ORG_DIR}/msp/config.yaml ${ADMN_DIR}/msp/config.yaml

  echo "  [${DOMAIN}] Done."
}

# ── provisionOrdererOrg ───────────────────────────────────────────────────────
# Usage: provisionOrdererOrg <caPort> <caName> <ordererHost> <domain>
# Example: provisionOrdererOrg 11054 ca-orderer orderer0 veritaschain.com
function provisionOrdererOrg() {
  local CA_PORT=$1 CA_NAME=$2 ORDERER_HOST=$3 DOMAIN=$4

  local ORG_DIR=${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN}
  local CA_TLS=${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem
  local CA_CERT_FILE="localhost-${CA_PORT}-${CA_NAME}.pem"

  echo "  [orderer.${DOMAIN}] Enrolling CA admin..."
  mkdir -p ${ORG_DIR}
  export FABRIC_CA_CLIENT_HOME=${ORG_DIR}

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    --tls.certfiles ${CA_TLS}

  cat > ${ORG_DIR}/msp/config.yaml <<NODEOUS
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: client
  AdminOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${CA_CERT_FILE}
    OrganizationalUnitIdentifier: orderer
NODEOUS

  echo "  [orderer.${DOMAIN}] Registering orderer and admin..."
  fabric-ca-client register --caname ${CA_NAME} \
    --id.name ${ORDERER_HOST} --id.secret ${ORDERER_HOST}pw --id.type orderer \
    --tls.certfiles ${CA_TLS}

  fabric-ca-client register --caname ${CA_NAME} \
    --id.name ordereradmin --id.secret ordereradminpw --id.type admin \
    --tls.certfiles ${CA_TLS}

  echo "  [orderer.${DOMAIN}] Enrolling orderer (MSP + TLS)..."
  local ORDERER_DIR=${ORG_DIR}/orderers/${ORDERER_HOST}.${DOMAIN}
  mkdir -p ${ORDERER_DIR}

  fabric-ca-client enroll \
    -u https://${ORDERER_HOST}:${ORDERER_HOST}pw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    -M ${ORDERER_DIR}/msp \
    --csr.hosts ${ORDERER_HOST}.${DOMAIN} --csr.hosts localhost \
    --tls.certfiles ${CA_TLS}
  cp ${ORG_DIR}/msp/config.yaml ${ORDERER_DIR}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://${ORDERER_HOST}:${ORDERER_HOST}pw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    -M ${ORDERER_DIR}/tls \
    --enrollment.profile tls \
    --csr.hosts ${ORDERER_HOST}.${DOMAIN} --csr.hosts localhost \
    --tls.certfiles ${CA_TLS}

  cp ${ORDERER_DIR}/tls/tlscacerts/* ${ORDERER_DIR}/tls/ca.crt
  cp ${ORDERER_DIR}/tls/signcerts/*  ${ORDERER_DIR}/tls/server.crt
  cp ${ORDERER_DIR}/tls/keystore/*_sk ${ORDERER_DIR}/tls/server.key

  echo "  [orderer.${DOMAIN}] Enrolling orderer admin identity..."
  local ADMN_DIR=${ORG_DIR}/users/Admin@${DOMAIN}
  mkdir -p ${ADMN_DIR}

  fabric-ca-client enroll \
    -u https://ordereradmin:ordereradminpw@localhost:${CA_PORT} \
    --caname ${CA_NAME} \
    -M ${ADMN_DIR}/msp \
    --tls.certfiles ${CA_TLS}
  cp ${ORG_DIR}/msp/config.yaml ${ADMN_DIR}/msp/config.yaml

  echo "  [orderer.${DOMAIN}] Done."
}
