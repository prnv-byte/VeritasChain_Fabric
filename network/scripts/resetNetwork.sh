#!/bin/bash

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="${NETWORK_DIR}/scripts"

echo "!!! Resetting VeritasChain network — all data will be wiped !!!"

# Stop and remove all containers
${SCRIPTS_DIR}/stopNetwork.sh

# Wipe crypto material and ledger data
rm -rf ${NETWORK_DIR}/organizations/peerOrganizations
rm -rf ${NETWORK_DIR}/organizations/ordererOrganizations
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/voltride/msp
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/battery/msp
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/motor/msp
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/chassis/msp
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/orderer/msp
rm -rf ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem
rm -rf ${NETWORK_DIR}/channel-artifacts
rm -rf ${NETWORK_DIR}/ledger

echo "Restart with: ./scripts/startNetwork.sh"
