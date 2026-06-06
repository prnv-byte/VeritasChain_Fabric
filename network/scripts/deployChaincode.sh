#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CC_NAME=veritasorder
CC_VERSION=1.0
CC_SEQUENCE=1
CC_SRC_PATH=${NETWORK_DIR}/../../chaincode/order
export FABRIC_CFG_PATH=${NETWORK_DIR}/config

ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/orderers/orderer0.veritaschain.com/tls/ca.crt

BATTERY_TLS=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/peers/peer0.battery.veritaschain.com/tls/ca.crt
MOTOR_TLS=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/peers/peer0.motor.veritaschain.com/tls/ca.crt
CHASSIS_TLS=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/peers/peer0.chassis.veritaschain.com/tls/ca.crt
VR_BATTERY_TLS=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/peerbattery.voltride.veritaschain.com/tls/ca.crt
VR_MOTOR_TLS=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/peermotor.voltride.veritaschain.com/tls/ca.crt
VR_CHASSIS_TLS=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/peerchassis.voltride.veritaschain.com/tls/ca.crt

setVoltrideBatteryPeer() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${VR_BATTERY_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:11051
}
setVoltrideMotorPeer() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${VR_MOTOR_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:12051
}
setVoltrideChassisPeer() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${VR_CHASSIS_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:13051
}
setBatteryPeer() {
  export CORE_PEER_LOCALMSPID=BatteryMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${BATTERY_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/users/Admin@battery.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:7051
}
setMotorPeer() {
  export CORE_PEER_LOCALMSPID=MotorMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${MOTOR_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/users/Admin@motor.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:9051
}
setChassisPeer() {
  export CORE_PEER_LOCALMSPID=ChassisMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${CHASSIS_TLS}
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/users/Admin@chassis.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:10051
}

echo "===== Deploying veritasorder chaincode ====="

# ── 1. Package ────────────────────────────────────────────────────────────────
echo ""
echo "--- Step 1: Package ---"
setVoltrideBatteryPeer
peer lifecycle chaincode package ${NETWORK_DIR}/channel-artifacts/${CC_NAME}.tar.gz \
  --path ${CC_SRC_PATH} \
  --lang golang \
  --label ${CC_NAME}_${CC_VERSION}

# ── 2. Install on all 6 peers ──────────────────────────────────────────────────
echo ""
echo "--- Step 2: Install on all peers ---"
for setPeer in setVoltrideBatteryPeer setVoltrideMotorPeer setVoltrideChassisPeer setBatteryPeer setMotorPeer setChassisPeer; do
  $setPeer
  peer lifecycle chaincode install ${NETWORK_DIR}/channel-artifacts/${CC_NAME}.tar.gz
done

# ── 3. Get package ID ─────────────────────────────────────────────────────────
echo ""
echo "--- Step 3: Query installed ---"
setBatteryPeer
CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "${CC_NAME}_${CC_VERSION}" | awk '{print $3}' | sed 's/,$//')
echo "Package ID: ${CC_PACKAGE_ID}"

# ── 4. Approve for voltride-battery ───────────────────────────────────────────
echo ""
echo "--- Step 4: Approve for voltride-battery ---"

setVoltrideBatteryPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-battery --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

setBatteryPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-battery --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

echo "Checking commit readiness for voltride-battery..."
setBatteryPeer
peer lifecycle chaincode checkcommitreadiness \
  --channelID voltride-battery --name ${CC_NAME} --version ${CC_VERSION} \
  --sequence ${CC_SEQUENCE} --tls --cafile ${ORDERER_CA} --output json

echo "Committing to voltride-battery..."
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-battery --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} \
  --peerAddresses localhost:11051 --tlsRootCertFiles ${VR_BATTERY_TLS} \
  --peerAddresses localhost:7051  --tlsRootCertFiles ${BATTERY_TLS} \
  --tls --cafile ${ORDERER_CA}

# ── 5. Approve for voltride-motor ──────────────────────────────────────────────
echo ""
echo "--- Step 5: Approve for voltride-motor ---"

setVoltrideMotorPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-motor --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

setMotorPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-motor --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

echo "Committing to voltride-motor..."
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-motor --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} \
  --peerAddresses localhost:12051 --tlsRootCertFiles ${VR_MOTOR_TLS} \
  --peerAddresses localhost:9051  --tlsRootCertFiles ${MOTOR_TLS} \
  --tls --cafile ${ORDERER_CA}

# ── 6. Approve for voltride-chassis ────────────────────────────────────────────
echo ""
echo "--- Step 6: Approve for voltride-chassis ---"

setVoltrideChassisPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-chassis --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

setChassisPeer
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-chassis --name ${CC_NAME} --version ${CC_VERSION} \
  --package-id ${CC_PACKAGE_ID} --sequence ${CC_SEQUENCE} \
  --tls --cafile ${ORDERER_CA}

echo "Committing to voltride-chassis..."
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.veritaschain.com \
  --channelID voltride-chassis --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} \
  --peerAddresses localhost:13051 --tlsRootCertFiles ${VR_CHASSIS_TLS} \
  --peerAddresses localhost:10051 --tlsRootCertFiles ${CHASSIS_TLS} \
  --tls --cafile ${ORDERER_CA}

echo ""
echo "veritasorder chaincode deployed to all 3 channels."
