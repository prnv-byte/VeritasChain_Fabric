#!/bin/bash
# =============================================================================
#  VoltRide Network — Live Demo Script
#  Full order lifecycle: CreateOrder → FulfillOrder → VerifyAndAccept
#  Channels: batterychannel | motorchannel | chassischannel
# =============================================================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE=/H/hyperledger/VoltRide-Network

pause() {
  echo ""
  echo -e "${YELLOW}──────────────────────────────────────────────────────${NC}"
  read -rp "  Press ENTER to continue to next step..." _
  echo -e "${YELLOW}──────────────────────────────────────────────────────${NC}"
  echo ""
}

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}  $1${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
}

step() {
  echo -e "${GREEN}${BOLD}▶  $1${NC}"
  echo ""
}

# =============================================================================
#  ENVIRONMENT
# =============================================================================
export FABRIC_CFG_PATH=$BASE/config
export CORE_PEER_TLS_ENABLED=true
export ORDERER_CA=$BASE/organizations/ordererOrganizations/example.com/orderers/orderer0.example.com/tls/ca.crt

as_voltride_battery() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_MSPCONFIGPATH=$BASE/organizations/peerOrganizations/voltride.example.com/users/Admin@voltride.example.com/msp
  export CORE_PEER_ADDRESS=peerbattery.voltride.example.com:11051
  export CORE_PEER_TLS_ROOTCERT_FILE=$BASE/organizations/peerOrganizations/voltride.example.com/peers/peerbattery.voltride.example.com/tls/ca.crt
}
as_voltride_motor() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_MSPCONFIGPATH=$BASE/organizations/peerOrganizations/voltride.example.com/users/Admin@voltride.example.com/msp
  export CORE_PEER_ADDRESS=peermotor.voltride.example.com:12051
  export CORE_PEER_TLS_ROOTCERT_FILE=$BASE/organizations/peerOrganizations/voltride.example.com/peers/peermotor.voltride.example.com/tls/ca.crt
}
as_voltride_chassis() {
  export CORE_PEER_LOCALMSPID=VoltRideMSP
  export CORE_PEER_MSPCONFIGPATH=$BASE/organizations/peerOrganizations/voltride.example.com/users/Admin@voltride.example.com/msp
  export CORE_PEER_ADDRESS=peerchassis.voltride.example.com:13051
  export CORE_PEER_TLS_ROOTCERT_FILE=$BASE/organizations/peerOrganizations/voltride.example.com/peers/peerchassis.voltride.example.com/tls/ca.crt
}
as_battery_supplier() {
  export CORE_PEER_LOCALMSPID=BatteryMSP
  export CORE_PEER_MSPCONFIGPATH=$BASE/organizations/peerOrganizations/battery.example.com/users/Admin@battery.example.com/msp
  export CORE_PEER_ADDRESS=peer0.battery.example.com:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$BASE/organizations/peerOrganizations/battery.example.com/peers/peer0.battery.example.com/tls/ca.crt
}
as_motor_supplier() {
  export CORE_PEER_LOCALMSPID=MotorMSP
  export CORE_PEER_MSPCONFIGPATH=$BASE/organizations/peerOrganizations/motor.example.com/users/Admin@motor.example.com/msp
  export CORE_PEER_ADDRESS=peer0.motor.example.com:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$BASE/organizations/peerOrganizations/motor.example.com/peers/peer0.motor.example.com/tls/ca.crt
}
as_chassis_supplier() {
  export CORE_PEER_LOCALMSPID=ChassisMSP
  export CORE_PEER_MSPCONFIGPATH=$BASE/organizations/peerOrganizations/chassis.example.com/users/Admin@chassis.example.com/msp
  export CORE_PEER_ADDRESS=peer0.chassis.example.com:10051
  export CORE_PEER_TLS_ROOTCERT_FILE=$BASE/organizations/peerOrganizations/chassis.example.com/peers/peer0.chassis.example.com/tls/ca.crt
}

# =============================================================================
#  STEP 0 — Network Health
# =============================================================================
banner "STEP 0 — VoltRide Network Health Check"

step "All running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}"
pause

step "Orderer Raft leader status:"
docker logs orderer0.example.com 2>&1 | grep -i "raft\|leader\|accepting" | tail -5
pause

# =============================================================================
#  STEP 1 — Chaincode committed on all 3 channels
# =============================================================================
banner "STEP 1 — Chaincode Committed on All 3 Channels"

step "battery on batterychannel:"
as_voltride_battery
peer lifecycle chaincode querycommitted \
  -C batterychannel -n battery \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA

echo ""
step "motor on motorchannel:"
as_voltride_motor
peer lifecycle chaincode querycommitted \
  -C motorchannel -n motor \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA

echo ""
step "chassis on chassischannel:"
as_voltride_chassis
peer lifecycle chaincode querycommitted \
  -C chassischannel -n chassis \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA
pause

# =============================================================================
#  STEP 2 — BATTERY CHANNEL
#  Ranges: nominalVoltage[2.5-4.5]V, internalResistance[0-500]mΩ,
#           capacity[1-500]Ah, soh[0-100]%, selfDischargeRate[0-10]%/month,
#           temperatureAtDelivery[-40-85]°C
# =============================================================================
banner "STEP 2 — Battery Channel: Full Order Lifecycle"

BATTERY_HASH="a3f1c2e4b5d6f7890a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f"
BATTERY_ZKP="eyJwcm9vZiI6InZhbGlkX3prX3Byb29mX2JhdHRlcnkifQ=="

step "2a. VoltRide creates battery order — ID: BATTERY-ORDER-001"
as_voltride_battery
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C batterychannel -n battery \
  --peerAddresses peerbattery.voltride.example.com:11051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peerbattery.voltride.example.com/tls/ca.crt \
  --peerAddresses peer0.battery.example.com:7051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/battery.example.com/peers/peer0.battery.example.com/tls/ca.crt \
  -c '{"function":"CreateOrder","Args":["BATTERY-ORDER-001","500","High-density lithium pack for EV"]}'
sleep 3

step "2b. GetOrder — expect status: PENDING"
peer chaincode query -C batterychannel -n battery \
  -c '{"function":"GetOrder","Args":["BATTERY-ORDER-001"]}'
pause

step "2c. BatteryOrg fulfills order with QC params + zkProof"
as_battery_supplier
# All values within validated ranges:
# nominalVoltage=3.7 [2.5-4.5], internalResistance=25.0 [0-500],
# capacity=50.0 [1-500], soh=95.0 [0-100],
# selfDischargeRate=2.0 [0-10], temperatureAtDelivery=25.0 [-40-85]
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C batterychannel -n battery \
  --peerAddresses peer0.battery.example.com:7051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/battery.example.com/peers/peer0.battery.example.com/tls/ca.crt \
  --peerAddresses peerbattery.voltride.example.com:11051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peerbattery.voltride.example.com/tls/ca.crt \
  -c "{\"function\":\"FulfillOrder\",\"Args\":[\"BATTERY-ORDER-001\",\"BATCH-BAT-2024\",\"{\\\"nominalVoltage\\\":3.7,\\\"internalResistance\\\":25.0,\\\"capacity\\\":50.0,\\\"soh\\\":95.0,\\\"selfDischargeRate\\\":2.0,\\\"temperatureAtDelivery\\\":25.0}\",\"$BATTERY_HASH\",\"$BATTERY_ZKP\"]}"
sleep 3

step "2d. GetOrder — expect status: FULFILLED"
as_voltride_battery
peer chaincode query -C batterychannel -n battery \
  -c '{"function":"GetOrder","Args":["BATTERY-ORDER-001"]}'
pause

step "2e. VoltRide verifies and accepts the order"
as_voltride_battery
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C batterychannel -n battery \
  --peerAddresses peerbattery.voltride.example.com:11051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peerbattery.voltride.example.com/tls/ca.crt \
  --peerAddresses peer0.battery.example.com:7051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/battery.example.com/peers/peer0.battery.example.com/tls/ca.crt \
  -c '{"function":"VerifyAndAccept","Args":["BATTERY-ORDER-001"]}'
sleep 3

step "2f. GetOrder — expect status: ACCEPTED"
peer chaincode query -C batterychannel -n battery \
  -c '{"function":"GetOrder","Args":["BATTERY-ORDER-001"]}'

echo ""
step "2g. Immutable on-chain history:"
peer chaincode query -C batterychannel -n battery \
  -c '{"function":"GetOrderHistory","Args":["BATTERY-ORDER-001"]}'
pause

# =============================================================================
#  STEP 3 — MOTOR CHANNEL
#  Ranges: ratedPower[0.1-100]kW, noLoadRpm[100-20000]RPM,
#           phaseWindingResistance[0.001-50]Ω, torqueOutput[0.1-500]Nm,
#           hallSensorOutput[0-12]V, efficiency[0-100]%
# =============================================================================
banner "STEP 3 — Motor Channel: Full Order Lifecycle"

MOTOR_HASH="b4e2d1f3a6c7890b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b"
MOTOR_ZKP="eyJwcm9vZiI6InZhbGlkX3prX3Byb29mX21vdG9yIn0="

step "3a. VoltRide creates motor order — ID: MOTOR-ORDER-001"
as_voltride_motor
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C motorchannel -n motor \
  --peerAddresses peermotor.voltride.example.com:12051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peermotor.voltride.example.com/tls/ca.crt \
  --peerAddresses peer0.motor.example.com:9051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/motor.example.com/peers/peer0.motor.example.com/tls/ca.crt \
  -c '{"function":"CreateOrder","Args":["MOTOR-ORDER-001","200","Brushless DC motor 15kW"]}'
sleep 3

step "3b. GetOrder — expect status: PENDING"
peer chaincode query -C motorchannel -n motor \
  -c '{"function":"GetOrder","Args":["MOTOR-ORDER-001"]}'
pause

step "3c. MotorOrg fulfills order with QC params + zkProof"
as_motor_supplier
# All values within validated ranges:
# ratedPower=15.0 [0.1-100], noLoadRpm=3000 [100-20000],
# phaseWindingResistance=0.5 [0.001-50], torqueOutput=48.0 [0.1-500],
# hallSensorOutput=5.0 [0-12], efficiency=92.0 [0-100]
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C motorchannel -n motor \
  --peerAddresses peer0.motor.example.com:9051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/motor.example.com/peers/peer0.motor.example.com/tls/ca.crt \
  --peerAddresses peermotor.voltride.example.com:12051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peermotor.voltride.example.com/tls/ca.crt \
  -c "{\"function\":\"FulfillOrder\",\"Args\":[\"MOTOR-ORDER-001\",\"BATCH-MOT-2024\",\"{\\\"ratedPower\\\":15.0,\\\"noLoadRpm\\\":3000,\\\"phaseWindingResistance\\\":0.5,\\\"torqueOutput\\\":48.0,\\\"hallSensorOutput\\\":5.0,\\\"efficiency\\\":92.0}\",\"$MOTOR_HASH\",\"$MOTOR_ZKP\"]}"
sleep 3

step "3d. GetOrder — expect status: FULFILLED"
as_voltride_motor
peer chaincode query -C motorchannel -n motor \
  -c '{"function":"GetOrder","Args":["MOTOR-ORDER-001"]}'
pause

step "3e. VoltRide verifies and accepts the order"
as_voltride_motor
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C motorchannel -n motor \
  --peerAddresses peermotor.voltride.example.com:12051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peermotor.voltride.example.com/tls/ca.crt \
  --peerAddresses peer0.motor.example.com:9051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/motor.example.com/peers/peer0.motor.example.com/tls/ca.crt \
  -c '{"function":"VerifyAndAccept","Args":["MOTOR-ORDER-001"]}'
sleep 3

step "3f. GetOrder — expect status: ACCEPTED"
peer chaincode query -C motorchannel -n motor \
  -c '{"function":"GetOrder","Args":["MOTOR-ORDER-001"]}'

echo ""
step "3g. Immutable on-chain history:"
peer chaincode query -C motorchannel -n motor \
  -c '{"function":"GetOrderHistory","Args":["MOTOR-ORDER-001"]}'
pause

# =============================================================================
#  STEP 4 — CHASSIS CHANNEL
#  Ranges: weldQuality[0-100], frameWeight[1-100]kg,
#           dimensionalAccuracy[0-50]mm, materialGrade(non-empty string),
#           surfaceDefectCount(>=0 int), loadBearingCapacity[1-5000]kg
# =============================================================================
banner "STEP 4 — Chassis Channel: Full Order Lifecycle"

CHASSIS_HASH="c5f3e2d4b7a890c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5"
CHASSIS_ZKP="eyJwcm9vZiI6InZhbGlkX3prX3Byb29mX2NoYXNzaXMifQ=="

step "4a. VoltRide creates chassis order — ID: CHASSIS-ORDER-001"
as_voltride_chassis
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C chassischannel -n chassis \
  --peerAddresses peerchassis.voltride.example.com:13051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peerchassis.voltride.example.com/tls/ca.crt \
  --peerAddresses peer0.chassis.example.com:10051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/chassis.example.com/peers/peer0.chassis.example.com/tls/ca.crt \
  -c '{"function":"CreateOrder","Args":["CHASSIS-ORDER-001","100","High-tensile steel EV frame"]}'
sleep 6

step "4b. GetOrder — expect status: PENDING"
peer chaincode query -C chassischannel -n chassis \
  -c '{"function":"GetOrder","Args":["CHASSIS-ORDER-001"]}'
pause

step "4c. ChassisOrg fulfills order with QC params + zkProof"
as_chassis_supplier
# All values within validated ranges:
# weldQuality=98.5 [0-100], frameWeight=45.0 [1-100],
# dimensionalAccuracy=0.05 [0-50], materialGrade="S235"(non-empty),
# surfaceDefectCount=0 (>=0 int), loadBearingCapacity=800.0 [1-5000]
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C chassischannel -n chassis \
  --peerAddresses peer0.chassis.example.com:10051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/chassis.example.com/peers/peer0.chassis.example.com/tls/ca.crt \
  --peerAddresses peerchassis.voltride.example.com:13051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peerchassis.voltride.example.com/tls/ca.crt \
  -c "{\"function\":\"FulfillOrder\",\"Args\":[\"CHASSIS-ORDER-001\",\"BATCH-CHS-2024\",\"{\\\"weldQuality\\\":98.5,\\\"frameWeight\\\":45.0,\\\"dimensionalAccuracy\\\":0.05,\\\"materialGrade\\\":\\\"S235\\\",\\\"surfaceDefectCount\\\":0,\\\"loadBearingCapacity\\\":800.0}\",\"$CHASSIS_HASH\",\"$CHASSIS_ZKP\"]}"
sleep 3

step "4d. GetOrder — expect status: FULFILLED"
as_voltride_chassis
peer chaincode query -C chassischannel -n chassis \
  -c '{"function":"GetOrder","Args":["CHASSIS-ORDER-001"]}'
pause

step "4e. VoltRide verifies and accepts the order"
as_voltride_chassis
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer0.example.com \
  --tls --cafile $ORDERER_CA \
  -C chassischannel -n chassis \
  --peerAddresses peerchassis.voltride.example.com:13051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/voltride.example.com/peers/peerchassis.voltride.example.com/tls/ca.crt \
  --peerAddresses peer0.chassis.example.com:10051 \
  --tlsRootCertFiles $BASE/organizations/peerOrganizations/chassis.example.com/peers/peer0.chassis.example.com/tls/ca.crt \
  -c '{"function":"VerifyAndAccept","Args":["CHASSIS-ORDER-001"]}'
sleep 3

step "4f. GetOrder — expect status: ACCEPTED"
peer chaincode query -C chassischannel -n chassis \
  -c '{"function":"GetOrder","Args":["CHASSIS-ORDER-001"]}'

echo ""
step "4g. Immutable on-chain history:"
peer chaincode query -C chassischannel -n chassis \
  -c '{"function":"GetOrderHistory","Args":["CHASSIS-ORDER-001"]}'
pause

# =============================================================================
#  STEP 5 — Channel isolation
# =============================================================================
banner "STEP 5 — Channel Isolation: Privacy by Design"

step "VoltRide sees all battery orders on its battery peer:"
as_voltride_battery
peer chaincode query -C batterychannel -n battery \
  -c '{"function":"GetAllOrders","Args":[]}'

echo ""
step "BatteryOrg sees only its own channel — isolated from motor and chassis:"
as_battery_supplier
peer chaincode query -C batterychannel -n battery \
  -c '{"function":"GetAllOrders","Args":[]}'

# =============================================================================
#  DONE
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ✅  VoltRide Demo Complete — All 3 Channels Verified  ${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
