'use strict';

const path = require('path');

const NETWORK_DIR = process.env.NETWORK_DIR ||
  path.resolve(__dirname, '..', '..', '..', 'network');

const orgs = {
  VoltRideMSP: {
    mspId: 'VoltRideMSP',
    domain: 'voltride.veritaschain.com',
    caPort: 7054,
    peers: {
      battery: { address: 'localhost:11051', tlsCert: 'peerbattery.voltride.veritaschain.com' },
      motor:   { address: 'localhost:12051', tlsCert: 'peermotor.voltride.veritaschain.com'   },
      chassis: { address: 'localhost:13051', tlsCert: 'peerchassis.voltride.veritaschain.com' },
    },
  },
  BatteryMSP: {
    mspId: 'BatteryMSP',
    domain: 'battery.veritaschain.com',
    caPort: 8054,
    peers: {
      peer0: { address: 'localhost:7051', tlsCert: 'peer0.battery.veritaschain.com' },
    },
  },
  MotorMSP: {
    mspId: 'MotorMSP',
    domain: 'motor.veritaschain.com',
    caPort: 9054,
    peers: {
      peer0: { address: 'localhost:9051', tlsCert: 'peer0.motor.veritaschain.com' },
    },
  },
  ChassisMSP: {
    mspId: 'ChassisMSP',
    domain: 'chassis.veritaschain.com',
    caPort: 10054,
    peers: {
      peer0: { address: 'localhost:10051', tlsCert: 'peer0.chassis.veritaschain.com' },
    },
  },
};

const channels = {
  battery: 'voltride-battery',
  motor:   'voltride-motor',
  chassis: 'voltride-chassis',
};

// Which peer alias to use for each org+channel combination
const peerForChannel = {
  VoltRideMSP: {
    'voltride-battery': 'battery',
    'voltride-motor':   'motor',
    'voltride-chassis': 'chassis',
  },
};

// Map a component type to its channel name
function channelForComponent(componentType) {
  const t = componentType.toLowerCase();
  if (t.includes('battery')) return channels.battery;
  if (t.includes('motor'))   return channels.motor;
  if (t.includes('chassis')) return channels.chassis;
  throw new Error(`Unknown component type: ${componentType}`);
}

// Build filesystem paths for an identity
function identityPaths(mspId, peerHostname, userName = 'Admin') {
  const org = orgs[mspId];
  if (!org) throw new Error(`Unknown MSP: ${mspId}`);

  const orgDir = mspId === 'VoltRideMSP'
    ? path.join(NETWORK_DIR, 'organizations', 'peerOrganizations', org.domain)
    : path.join(NETWORK_DIR, 'organizations', 'peerOrganizations', org.domain);

  const certPath = path.join(orgDir, 'users', `${userName}@${org.domain}`, 'msp', 'signcerts');
  const keyPath  = path.join(orgDir, 'users', `${userName}@${org.domain}`, 'msp', 'keystore');
  const tlsCert  = path.join(orgDir, 'peers', peerHostname, 'tls', 'ca.crt');

  return { certPath, keyPath, tlsCert };
}

module.exports = { NETWORK_DIR, orgs, channels, peerForChannel, channelForComponent, identityPaths };
