'use strict';

const Org = require('../models/Org');

// Ports that are permanently reserved and must never be assigned to orgs
const RESERVED_PORTS = new Set([
  7050,  // orderer gRPC
  7053,  // orderer admin
  11054, // orderer CA
  27017, // MongoDB
]);

// CA ports: start at 7054, step 1000 (7054, 8054, 9054, ...)
const CA_PORT_START = 7054;
const CA_PORT_STEP  = 1000;

// Peer ports: start at 7051, step 2000 (7051, 9051, 11051, ...)
// CC port is always peerPort + 1
const PEER_PORT_START = 7051;
const PEER_PORT_STEP  = 2000;

async function getUsedCaPorts() {
  const orgs = await Org.find({ caPort: { $exists: true, $ne: null } }).select('caPort');
  return new Set(orgs.map(o => o.caPort));
}

async function getUsedPeerPorts() {
  const orgs = await Org.find({ peerPort: { $exists: true, $ne: null } }).select('peerPort ccPort');
  const ports = new Set();
  for (const o of orgs) {
    if (o.peerPort) ports.add(o.peerPort);
    if (o.ccPort)   ports.add(o.ccPort);
  }
  return ports;
}

/**
 * Assign the next available CA port.
 * Starts at CA_PORT_START and increments by CA_PORT_STEP.
 * Skips reserved ports and ports already in use.
 */
async function assignCaPort() {
  const usedCaPorts = await getUsedCaPorts();
  let port = CA_PORT_START;
  while (true) {
    if (!RESERVED_PORTS.has(port) && !usedCaPorts.has(port)) {
      return port;
    }
    port += CA_PORT_STEP;
    if (port > 65000) throw new Error('No available CA ports');
  }
}

/**
 * Assign the next available peer port.
 * Starts at PEER_PORT_START and increments by PEER_PORT_STEP.
 * Also checks that ccPort (peerPort + 1) is free.
 * Skips reserved ports and ports already in use.
 */
async function assignPeerPort() {
  const usedPeerPorts = await getUsedPeerPorts();
  let port = PEER_PORT_START;
  while (true) {
    const ccPort = port + 1;
    if (
      !RESERVED_PORTS.has(port) && !usedPeerPorts.has(port) &&
      !RESERVED_PORTS.has(ccPort) && !usedPeerPorts.has(ccPort)
    ) {
      return port;
    }
    port += PEER_PORT_STEP;
    if (port > 65000) throw new Error('No available peer ports');
  }
}

module.exports = { assignCaPort, assignPeerPort };
