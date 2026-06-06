#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export FABRIC_CFG_PATH=${NETWORK_DIR}/config

ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/orderers/orderer0.veritaschain.com/tls/ca.crt
ORDERER_ADMIN_TLS_SIGN_CERT=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/orderers/orderer0.veritaschain.com/tls/server.crt
ORDERER_ADMIN_TLS_PRIVATE_KEY=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/orderers/orderer0.veritaschain.com/tls/server.key

mkdir -p ${NETWORK_DIR}/channel-artifacts

echo "===== Creating VeritasChain Channels ====="

# ── Helper: set env for a peer ────────────────────────────────────────────────

setVoltrideBatteryPeer() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/peerbattery.voltride.veritaschain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:11051
}

setVoltrideMotorPeer() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/peermotor.voltride.veritaschain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:12051
}

setVoltrideChassisPeer() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/peerchassis.voltride.veritaschain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:13051
}

setBatteryPeer() {
  export CORE_PEER_LOCALMSPID=BatteryMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/peers/peer0.battery.veritaschain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/users/Admin@battery.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:7051
}

setMotorPeer() {
  export CORE_PEER_LOCALMSPID=MotorMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/peers/peer0.motor.veritaschain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/users/Admin@motor.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:9051
}

setChassisPeer() {
  export CORE_PEER_LOCALMSPID=ChassisMSP
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/peers/peer0.chassis.veritaschain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/users/Admin@chassis.veritaschain.com/msp
  export CORE_PEER_ADDRESS=localhost:10051
}

# ── voltride-battery channel ──────────────────────────────────────────────────

echo ""
echo "--- Creating voltride-battery channel ---"

export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile BatteryChannel -outputBlock ${NETWORK_DIR}/channel-artifacts/voltride-battery.block -channelID voltride-battery

osnadmin channel join \
  --channelID voltride-battery \
  --config-block ${NETWORK_DIR}/channel-artifacts/voltride-battery.block \
  -o localhost:7053 \
  --ca-file ${ORDERER_CA} \
  --client-cert ${ORDERER_ADMIN_TLS_SIGN_CERT} \
  --client-key ${ORDERER_ADMIN_TLS_PRIVATE_KEY}

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
sleep 2

echo "Joining peerbattery.voltride to voltride-battery..."
setVoltrideBatteryPeer
peer channel join -b ${NETWORK_DIR}/channel-artifacts/voltride-battery.block \
  --tls --cafile ${ORDERER_CA}

echo "Joining peer0.battery to voltride-battery..."
setBatteryPeer
peer channel join -b ${NETWORK_DIR}/channel-artifacts/voltride-battery.block \
  --tls --cafile ${ORDERER_CA}

echo "Updating VoltRide anchor peer on voltride-battery..."
export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile BatteryChannel -outputAnchorPeersUpdate \
  ${NETWORK_DIR}/channel-artifacts/VoltRideBatteryAnchors.tx \
  -channelID voltride-battery -asOrg VoltRideOrg

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
setVoltrideBatteryPeer
peer channel update -o localhost:7050 -c voltride-battery \
  -f ${NETWORK_DIR}/channel-artifacts/VoltRideBatteryAnchors.tx \
  --tls --cafile ${ORDERER_CA}

echo "Updating Battery anchor peer on voltride-battery..."
export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile BatteryChannel -outputAnchorPeersUpdate \
  ${NETWORK_DIR}/channel-artifacts/BatteryAnchors.tx \
  -channelID voltride-battery -asOrg BatteryOrg

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
setBatteryPeer
peer channel update -o localhost:7050 -c voltride-battery \
  -f ${NETWORK_DIR}/channel-artifacts/BatteryAnchors.tx \
  --tls --cafile ${ORDERER_CA}

# ── voltride-motor channel ────────────────────────────────────────────────────

echo ""
echo "--- Creating voltride-motor channel ---"

export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile MotorChannel -outputBlock ${NETWORK_DIR}/channel-artifacts/voltride-motor.block -channelID voltride-motor

osnadmin channel join \
  --channelID voltride-motor \
  --config-block ${NETWORK_DIR}/channel-artifacts/voltride-motor.block \
  -o localhost:7053 \
  --ca-file ${ORDERER_CA} \
  --client-cert ${ORDERER_ADMIN_TLS_SIGN_CERT} \
  --client-key ${ORDERER_ADMIN_TLS_PRIVATE_KEY}

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
sleep 2

setVoltrideMotorPeer
peer channel join -b ${NETWORK_DIR}/channel-artifacts/voltride-motor.block \
  --tls --cafile ${ORDERER_CA}

setMotorPeer
peer channel join -b ${NETWORK_DIR}/channel-artifacts/voltride-motor.block \
  --tls --cafile ${ORDERER_CA}

export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile MotorChannel -outputAnchorPeersUpdate \
  ${NETWORK_DIR}/channel-artifacts/VoltRideMotorAnchors.tx \
  -channelID voltride-motor -asOrg VoltRideOrg
configtxgen -profile MotorChannel -outputAnchorPeersUpdate \
  ${NETWORK_DIR}/channel-artifacts/MotorAnchors.tx \
  -channelID voltride-motor -asOrg MotorOrg

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
setVoltrideMotorPeer
peer channel update -o localhost:7050 -c voltride-motor \
  -f ${NETWORK_DIR}/channel-artifacts/VoltRideMotorAnchors.tx \
  --tls --cafile ${ORDERER_CA}
setMotorPeer
peer channel update -o localhost:7050 -c voltride-motor \
  -f ${NETWORK_DIR}/channel-artifacts/MotorAnchors.tx \
  --tls --cafile ${ORDERER_CA}

# ── voltride-chassis channel ──────────────────────────────────────────────────

echo ""
echo "--- Creating voltride-chassis channel ---"

export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile ChassisChannel -outputBlock ${NETWORK_DIR}/channel-artifacts/voltride-chassis.block -channelID voltride-chassis

osnadmin channel join \
  --channelID voltride-chassis \
  --config-block ${NETWORK_DIR}/channel-artifacts/voltride-chassis.block \
  -o localhost:7053 \
  --ca-file ${ORDERER_CA} \
  --client-cert ${ORDERER_ADMIN_TLS_SIGN_CERT} \
  --client-key ${ORDERER_ADMIN_TLS_PRIVATE_KEY}

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
sleep 2

setVoltrideChassisPeer
peer channel join -b ${NETWORK_DIR}/channel-artifacts/voltride-chassis.block \
  --tls --cafile ${ORDERER_CA}

setChassisPeer
peer channel join -b ${NETWORK_DIR}/channel-artifacts/voltride-chassis.block \
  --tls --cafile ${ORDERER_CA}

export FABRIC_CFG_PATH=${NETWORK_DIR}/configtx
configtxgen -profile ChassisChannel -outputAnchorPeersUpdate \
  ${NETWORK_DIR}/channel-artifacts/VoltRideChassisAnchors.tx \
  -channelID voltride-chassis -asOrg VoltRideOrg
configtxgen -profile ChassisChannel -outputAnchorPeersUpdate \
  ${NETWORK_DIR}/channel-artifacts/ChassisAnchors.tx \
  -channelID voltride-chassis -asOrg ChassisOrg

export FABRIC_CFG_PATH=${NETWORK_DIR}/config
setVoltrideChassisPeer
peer channel update -o localhost:7050 -c voltride-chassis \
  -f ${NETWORK_DIR}/channel-artifacts/VoltRideChassisAnchors.tx \
  --tls --cafile ${ORDERER_CA}
setChassisPeer
peer channel update -o localhost:7050 -c voltride-chassis \
  -f ${NETWORK_DIR}/channel-artifacts/ChassisAnchors.tx \
  --tls --cafile ${ORDERER_CA}

echo ""
echo "All 3 channels created and peers joined."
