#!/bin/bash

# VeritasChain identity registration and enrollment script.
# Source this file and call individual functions, or call registerAll.
# Run from the network/ directory.

NETWORK_DIR="${NETWORK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

# ── Orderer Org ───────────────────────────────────────────────────────────────

function enrollOrdererCAAdmin() {
  mkdir -p ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:11054 \
    --caname ca-orderer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem

  cat > ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-11054-ca-orderer.pem
    OrganizationalUnitIdentifier: client
  AdminOUIdentifier:
    Certificate: cacerts/localhost-11054-ca-orderer.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-11054-ca-orderer.pem
    OrganizationalUnitIdentifier: orderer
EOF
}

function registerOrdererIdentities() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com

  fabric-ca-client register --caname ca-orderer \
    --id.name orderer0 --id.secret orderer0pw --id.type orderer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem

  fabric-ca-client register --caname ca-orderer \
    --id.name ordereradmin --id.secret ordereradminpw --id.type admin \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem
}

function generateOrderer() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com
  ORDERER_PATH=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/orderers/orderer0.veritaschain.com
  mkdir -p ${ORDERER_PATH}

  fabric-ca-client enroll \
    -u https://orderer0:orderer0pw@localhost:11054 \
    --caname ca-orderer \
    -M ${ORDERER_PATH}/msp \
    --csr.hosts orderer0.veritaschain.com --csr.hosts localhost \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem

  cp ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/msp/config.yaml ${ORDERER_PATH}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://orderer0:orderer0pw@localhost:11054 \
    --caname ca-orderer \
    -M ${ORDERER_PATH}/tls \
    --enrollment.profile tls \
    --csr.hosts orderer0.veritaschain.com --csr.hosts localhost \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem

  rm -f ${ORDERER_PATH}/tls/ca.crt ${ORDERER_PATH}/tls/server.crt ${ORDERER_PATH}/tls/server.key
  cp ${ORDERER_PATH}/tls/tlscacerts/* ${ORDERER_PATH}/tls/ca.crt
  cp ${ORDERER_PATH}/tls/signcerts/* ${ORDERER_PATH}/tls/server.crt
  cp ${ORDERER_PATH}/tls/keystore/*_sk ${ORDERER_PATH}/tls/server.key
}

function generateOrdererAdmin() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com
  mkdir -p ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/users/Admin@veritaschain.com

  fabric-ca-client enroll \
    -u https://ordereradmin:ordereradminpw@localhost:11054 \
    --caname ca-orderer \
    -M ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/users/Admin@veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/orderer/tls-cert.pem

  cp ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/ordererOrganizations/veritaschain.com/users/Admin@veritaschain.com/msp/config.yaml
}

# ── VoltRide Org ──────────────────────────────────────────────────────────────

function enrollVoltrideCAAdmin() {
  mkdir -p ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:7054 \
    --caname ca-voltride \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem

  cat > ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-voltride.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-voltride.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-voltride.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-7054-ca-voltride.pem
    OrganizationalUnitIdentifier: orderer
EOF
}

function registerVoltrideIdentities() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com

  fabric-ca-client register --caname ca-voltride \
    --id.name peerbattery --id.secret peerbatterypw --id.type peer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem

  fabric-ca-client register --caname ca-voltride \
    --id.name peermotor --id.secret peermotorpw --id.type peer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem

  fabric-ca-client register --caname ca-voltride \
    --id.name peerchassis --id.secret peerchassispw --id.type peer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem

  fabric-ca-client register --caname ca-voltride \
    --id.name user1 --id.secret user1pw --id.type client \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem

  fabric-ca-client register --caname ca-voltride \
    --id.name voltrideadmin --id.secret voltrideadminpw --id.type admin \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem
}

function _enrollVoltridePeer() {
  local PEER_NAME=$1
  local PEER_SECRET=$2
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com
  PEER_PATH=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/peers/${PEER_NAME}.voltride.veritaschain.com
  mkdir -p ${PEER_PATH}

  fabric-ca-client enroll \
    -u https://${PEER_NAME}:${PEER_SECRET}@localhost:7054 \
    --caname ca-voltride \
    -M ${PEER_PATH}/msp \
    --csr.hosts ${PEER_NAME}.voltride.veritaschain.com \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/msp/config.yaml ${PEER_PATH}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://${PEER_NAME}:${PEER_SECRET}@localhost:7054 \
    --caname ca-voltride \
    -M ${PEER_PATH}/tls \
    --enrollment.profile tls \
    --csr.hosts ${PEER_NAME}.voltride.veritaschain.com --csr.hosts localhost \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem

  rm -f ${PEER_PATH}/tls/ca.crt ${PEER_PATH}/tls/server.crt ${PEER_PATH}/tls/server.key
  cp ${PEER_PATH}/tls/tlscacerts/* ${PEER_PATH}/tls/ca.crt
  cp ${PEER_PATH}/tls/signcerts/* ${PEER_PATH}/tls/server.crt
  cp ${PEER_PATH}/tls/keystore/*_sk ${PEER_PATH}/tls/server.key
}

function generateVoltRideBatteryPeer() { _enrollVoltridePeer peerbattery peerbatterypw; }
function generateVoltRideMotorPeer()   { _enrollVoltridePeer peermotor   peermotorpw;   }
function generateVoltRideChassisPeer() { _enrollVoltridePeer peerchassis peerchassispw; }

function generateVoltrideUsers() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com

  fabric-ca-client enroll \
    -u https://user1:user1pw@localhost:7054 \
    --caname ca-voltride \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/User1@voltride.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/User1@voltride.veritaschain.com/msp/config.yaml

  fabric-ca-client enroll \
    -u https://voltrideadmin:voltrideadminpw@localhost:7054 \
    --caname ca-voltride \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/voltride/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/voltride.veritaschain.com/users/Admin@voltride.veritaschain.com/msp/config.yaml
}

# ── Battery Org ───────────────────────────────────────────────────────────────

function enrollBatteryCAAdmin() {
  mkdir -p ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:8054 \
    --caname ca-battery \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem

  cat > ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-battery.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-battery.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-battery.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-8054-ca-battery.pem
    OrganizationalUnitIdentifier: orderer
EOF
}

function registerBatteryIdentities() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com
  fabric-ca-client register --caname ca-battery \
    --id.name peer0 --id.secret peer0pw --id.type peer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
  fabric-ca-client register --caname ca-battery \
    --id.name user1 --id.secret user1pw --id.type client \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
  fabric-ca-client register --caname ca-battery \
    --id.name batteryadmin --id.secret batteryadminpw --id.type admin \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
}

function generateBatteryPeer0() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com
  PEER_PATH=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/peers/peer0.battery.veritaschain.com
  mkdir -p ${PEER_PATH}

  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:8054 --caname ca-battery \
    -M ${PEER_PATH}/msp --csr.hosts peer0.battery.veritaschain.com \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/msp/config.yaml ${PEER_PATH}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:8054 --caname ca-battery \
    -M ${PEER_PATH}/tls --enrollment.profile tls \
    --csr.hosts peer0.battery.veritaschain.com --csr.hosts localhost \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem

  rm -f ${PEER_PATH}/tls/ca.crt ${PEER_PATH}/tls/server.crt ${PEER_PATH}/tls/server.key
  cp ${PEER_PATH}/tls/tlscacerts/* ${PEER_PATH}/tls/ca.crt
  cp ${PEER_PATH}/tls/signcerts/* ${PEER_PATH}/tls/server.crt
  cp ${PEER_PATH}/tls/keystore/*_sk ${PEER_PATH}/tls/server.key
}

function generateBatteryUsers() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com

  fabric-ca-client enroll \
    -u https://user1:user1pw@localhost:8054 --caname ca-battery \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/users/User1@battery.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/users/User1@battery.veritaschain.com/msp/config.yaml

  fabric-ca-client enroll \
    -u https://batteryadmin:batteryadminpw@localhost:8054 --caname ca-battery \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/users/Admin@battery.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/battery/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/battery.veritaschain.com/users/Admin@battery.veritaschain.com/msp/config.yaml
}

# ── Motor Org ─────────────────────────────────────────────────────────────────

function enrollMotorCAAdmin() {
  mkdir -p ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:9054 --caname ca-motor \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem

  cat > ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-motor.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-motor.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-motor.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-9054-ca-motor.pem
    OrganizationalUnitIdentifier: orderer
EOF
}

function registerMotorIdentities() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com
  fabric-ca-client register --caname ca-motor \
    --id.name peer0 --id.secret peer0pw --id.type peer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
  fabric-ca-client register --caname ca-motor \
    --id.name user1 --id.secret user1pw --id.type client \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
  fabric-ca-client register --caname ca-motor \
    --id.name motoradmin --id.secret motoradminpw --id.type admin \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
}

function generateMotorPeer0() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com
  PEER_PATH=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/peers/peer0.motor.veritaschain.com
  mkdir -p ${PEER_PATH}

  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:9054 --caname ca-motor \
    -M ${PEER_PATH}/msp --csr.hosts peer0.motor.veritaschain.com \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/msp/config.yaml ${PEER_PATH}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:9054 --caname ca-motor \
    -M ${PEER_PATH}/tls --enrollment.profile tls \
    --csr.hosts peer0.motor.veritaschain.com --csr.hosts localhost \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem

  rm -f ${PEER_PATH}/tls/ca.crt ${PEER_PATH}/tls/server.crt ${PEER_PATH}/tls/server.key
  cp ${PEER_PATH}/tls/tlscacerts/* ${PEER_PATH}/tls/ca.crt
  cp ${PEER_PATH}/tls/signcerts/* ${PEER_PATH}/tls/server.crt
  cp ${PEER_PATH}/tls/keystore/*_sk ${PEER_PATH}/tls/server.key
}

function generateMotorUsers() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com

  fabric-ca-client enroll \
    -u https://user1:user1pw@localhost:9054 --caname ca-motor \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/users/User1@motor.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/users/User1@motor.veritaschain.com/msp/config.yaml

  fabric-ca-client enroll \
    -u https://motoradmin:motoradminpw@localhost:9054 --caname ca-motor \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/users/Admin@motor.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/motor/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/motor.veritaschain.com/users/Admin@motor.veritaschain.com/msp/config.yaml
}

# ── Chassis Org ───────────────────────────────────────────────────────────────

function enrollChassisCAAdmin() {
  mkdir -p ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com

  fabric-ca-client enroll \
    -u https://admin:adminpw@localhost:10054 --caname ca-chassis \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem

  cat > ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-10054-ca-chassis.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-10054-ca-chassis.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-10054-ca-chassis.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-10054-ca-chassis.pem
    OrganizationalUnitIdentifier: orderer
EOF
}

function registerChassisIdentities() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com
  fabric-ca-client register --caname ca-chassis \
    --id.name peer0 --id.secret peer0pw --id.type peer \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
  fabric-ca-client register --caname ca-chassis \
    --id.name user1 --id.secret user1pw --id.type client \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
  fabric-ca-client register --caname ca-chassis \
    --id.name chassisadmin --id.secret chassisadminpw --id.type admin \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
}

function generateChassisPeer0() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com
  PEER_PATH=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/peers/peer0.chassis.veritaschain.com
  mkdir -p ${PEER_PATH}

  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:10054 --caname ca-chassis \
    -M ${PEER_PATH}/msp --csr.hosts peer0.chassis.veritaschain.com \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/msp/config.yaml ${PEER_PATH}/msp/config.yaml

  fabric-ca-client enroll \
    -u https://peer0:peer0pw@localhost:10054 --caname ca-chassis \
    -M ${PEER_PATH}/tls --enrollment.profile tls \
    --csr.hosts peer0.chassis.veritaschain.com --csr.hosts localhost \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem

  rm -f ${PEER_PATH}/tls/ca.crt ${PEER_PATH}/tls/server.crt ${PEER_PATH}/tls/server.key
  cp ${PEER_PATH}/tls/tlscacerts/* ${PEER_PATH}/tls/ca.crt
  cp ${PEER_PATH}/tls/signcerts/* ${PEER_PATH}/tls/server.crt
  cp ${PEER_PATH}/tls/keystore/*_sk ${PEER_PATH}/tls/server.key
}

function generateChassisUsers() {
  export FABRIC_CA_CLIENT_HOME=${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com

  fabric-ca-client enroll \
    -u https://user1:user1pw@localhost:10054 --caname ca-chassis \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/users/User1@chassis.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/users/User1@chassis.veritaschain.com/msp/config.yaml

  fabric-ca-client enroll \
    -u https://chassisadmin:chassisadminpw@localhost:10054 --caname ca-chassis \
    -M ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/users/Admin@chassis.veritaschain.com/msp \
    --tls.certfiles ${NETWORK_DIR}/organizations/fabric-ca/chassis/tls-cert.pem
  cp ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/msp/config.yaml \
     ${NETWORK_DIR}/organizations/peerOrganizations/chassis.veritaschain.com/users/Admin@chassis.veritaschain.com/msp/config.yaml
}

# ── Register All ──────────────────────────────────────────────────────────────

function registerAll() {
  echo "--- Orderer Org ---"
  enrollOrdererCAAdmin
  registerOrdererIdentities
  generateOrderer
  generateOrdererAdmin

  echo "--- VoltRide Org ---"
  enrollVoltrideCAAdmin
  registerVoltrideIdentities
  generateVoltRideBatteryPeer
  generateVoltRideMotorPeer
  generateVoltRideChassisPeer
  generateVoltrideUsers

  echo "--- Battery Org ---"
  enrollBatteryCAAdmin
  registerBatteryIdentities
  generateBatteryPeer0
  generateBatteryUsers

  echo "--- Motor Org ---"
  enrollMotorCAAdmin
  registerMotorIdentities
  generateMotorPeer0
  generateMotorUsers

  echo "--- Chassis Org ---"
  enrollChassisCAAdmin
  registerChassisIdentities
  generateChassisPeer0
  generateChassisUsers

  echo "All identities registered and enrolled."
}
