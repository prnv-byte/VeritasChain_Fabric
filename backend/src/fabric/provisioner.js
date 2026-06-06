'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs   = require('fs');

const execAsync = promisify(exec);

const NETWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'network');
const DOMAIN = 'veritaschain.com';

// ── Name transforms ───────────────────────────────────────────────────────────

/** "Tata Motors" → "TataMotorsMSP" */
function toMspId(orgName) {
  return orgName.replace(/\s+/g, '') + 'MSP';
}

/** "Tata Motors" → "tatamotors.veritaschain.com" */
function toDomain(orgName) {
  return orgName.toLowerCase().replace(/\s+/g, '') + '.' + DOMAIN;
}

/** "Tata Motors" → "tatamotors" */
function toFolderName(orgName) {
  return orgName.toLowerCase().replace(/\s+/g, '');
}

/** Generate a channel name from two org objects */
function toChannelName(mfgOrg, splrOrg) {
  const mfgSlug  = mfgOrg.name.toLowerCase().replace(/\s+/g, '');
  const splrSlug = splrOrg.name.toLowerCase().replace(/\s+/g, '');
  return `ch-${mfgSlug}-${splrSlug}`;
}

// ── Docker helpers ────────────────────────────────────────────────────────────

/** Start a Fabric CA container for an org */
async function startCaContainer(org) {
  const folderName = toFolderName(org.name);
  const caName     = `ca-${folderName}`;
  const orgDataDir = path.join(NETWORK_DIR, 'organizations', 'fabric-ca', folderName);
  fs.mkdirSync(orgDataDir, { recursive: true });

  // Remove any existing container with the same name
  await execAsync(`docker rm -f ${caName}`).catch(() => {});

  const cmd = [
    'docker run -d',
    `--name ${caName}`,
    '--network veritaschain',
    '-e FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server',
    `-e FABRIC_CA_SERVER_CA_NAME=${caName}`,
    '-e FABRIC_CA_SERVER_TLS_ENABLED=true',
    `-e FABRIC_CA_SERVER_PORT=${org.caPort}`,
    `-p ${org.caPort}:${org.caPort}`,
    `-v ${orgDataDir}:/etc/hyperledger/fabric-ca-server`,
    'hyperledger/fabric-ca:latest',
    "sh -c 'fabric-ca-server start -b admin:adminpw -d'",
  ].join(' \\\n    ');

  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

/** Start a Fabric peer container for an org */
async function startPeerContainer(org) {
  const peerHost  = `${org.peerName}.${org.domain}`;
  const orgDir    = path.join(NETWORK_DIR, 'organizations', 'peerOrganizations', org.domain);
  const mspDir    = path.join(orgDir, 'peers', peerHost, 'msp');
  const tlsDir    = path.join(orgDir, 'peers', peerHost, 'tls');
  const ledgerDir = path.join(NETWORK_DIR, 'ledger', peerHost);

  fs.mkdirSync(ledgerDir, { recursive: true });

  // Remove any existing container
  await execAsync(`docker rm -f ${peerHost}`).catch(() => {});

  const cmd = [
    'docker run -d',
    `--name ${peerHost}`,
    `--hostname ${peerHost}`,
    '--network veritaschain',
    `-e FABRIC_LOGGING_SPEC=INFO`,
    `-e CORE_PEER_ID=${peerHost}`,
    `-e CORE_PEER_ADDRESS=${peerHost}:${org.peerPort}`,
    `-e CORE_PEER_LISTENADDRESS=0.0.0.0:${org.peerPort}`,
    `-e CORE_PEER_GOSSIP_BOOTSTRAP=${peerHost}:${org.peerPort}`,
    `-e CORE_PEER_GOSSIP_EXTERNALENDPOINT=${peerHost}:${org.peerPort}`,
    `-e CORE_PEER_LOCALMSPID=${org.mspId}`,
    `-e CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp`,
    `-e CORE_PEER_TLS_ENABLED=true`,
    `-e CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt`,
    `-e CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key`,
    `-e CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt`,
    `-e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock`,
    `-e CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=veritaschain`,
    `-e CORE_PEER_CHAINCODEADDRESS=${peerHost}:${org.ccPort}`,
    `-e CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:${org.ccPort}`,
    `-p ${org.peerPort}:${org.peerPort}`,
    `-p ${org.ccPort}:${org.ccPort}`,
    `-v /var/run/docker.sock:/host/var/run/docker.sock`,
    `-v ${mspDir}:/etc/hyperledger/fabric/msp`,
    `-v ${tlsDir}:/etc/hyperledger/fabric/tls`,
    `-v ${ledgerDir}:/var/hyperledger/production`,
    `hyperledger/fabric-peer:2.5`,
    `peer node start`,
  ].join(' \\\n    ');

  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

// ── Full org provisioning ─────────────────────────────────────────────────────

/**
 * Provision a new org:
 *  1. Start CA container
 *  2. Wait for CA (10s)
 *  3. Run provisionPeerOrg from provisionOrg.sh
 *  4. Start peer container
 *  5. Wait for peer (5s)
 *
 * @param {object} org - { name, mspId, domain, caPort, peerPort, ccPort, peerName }
 */
async function provisionOrg(org) {
  const folderName = toFolderName(org.name);
  const caName     = `ca-${folderName}`;

  console.log(`[provisioner] Starting CA container for ${org.name}...`);
  await startCaContainer(org);

  // Wait for CA to be ready
  await new Promise(r => setTimeout(r, 10000));

  console.log(`[provisioner] Running provisionPeerOrg for ${org.name}...`);
  // Build inline bash snippet that sources provisionOrg.sh and calls provisionPeerOrg
  // We pass peer0 with only name:port (no ccPort) as expected by the function
  const peerStr  = `${org.peerName}:${org.peerPort}`;

  // Escape single quotes in all values before embedding into bash -c '...'
  const escape   = (s) => String(s).replace(/'/g, "'\\''");

  const script = `
set -e
export NETWORK_DIR='${escape(NETWORK_DIR)}'
export FABRIC_CA_CLIENT_HOME=''
. '${escape(NETWORK_DIR)}/scripts/provisionOrg.sh'
provisionPeerOrg \
  '${escape(folderName)}' \
  '${escape(caName)}' \
  '${escape(org.caPort)}' \
  '${escape(org.domain)}' \
  '${escape(org.mspId)}' \
  '${escape(peerStr)}'
`;

  const { stdout, stderr } = await execAsync(`bash -c '${script.replace(/'/g, "'\\''")}'`, {
    env: { ...process.env, NETWORK_DIR },
    timeout: 120000,
  });

  if (stdout) console.log(`[provisioner:stdout] ${stdout}`);
  if (stderr) console.error(`[provisioner:stderr] ${stderr}`);

  console.log(`[provisioner] Starting peer container for ${org.name}...`);
  await startPeerContainer(org);

  // Wait for peer gRPC to be ready
  await new Promise(r => setTimeout(r, 5000));

  console.log(`[provisioner] Org ${org.name} provisioned successfully.`);
}

// ── Channel creation ──────────────────────────────────────────────────────────

/**
 * Create a channel between manufacturer and supplier:
 *  1. Generate per-channel configtx.yaml in /tmp
 *  2. Call createChannel.sh (passes configtxDir as 10th arg)
 *  3. Call deployChaincode.sh
 *
 * @param {string} channelName
 * @param {object} mfgOrg - plain object (from .toObject() or mongo doc)
 * @param {object} splrOrg - plain object
 */
async function createChannel(channelName, mfgOrg, splrOrg) {
  const { writeChannelConfigtx } = require('./configGenerator');

  console.log(`[provisioner] Generating configtx for channel ${channelName}...`);
  const configtxDir = writeChannelConfigtx(channelName, mfgOrg, splrOrg);

  console.log(`[provisioner] Creating channel ${channelName}...`);
  const createCmd = [
    `"${NETWORK_DIR}/scripts/createChannel.sh"`,
    `"${channelName}"`,
    `"${mfgOrg.mspId}" "${mfgOrg.domain}" "${mfgOrg.peerName}" "${mfgOrg.peerPort}"`,
    `"${splrOrg.mspId}" "${splrOrg.domain}" "${splrOrg.peerName}" "${splrOrg.peerPort}"`,
    `"${configtxDir}"`,
  ].join(' \\\n  ');

  const { stdout: chOut, stderr: chErr } = await execAsync(createCmd, {
    env: { ...process.env, NETWORK_DIR, FABRIC_CFG_PATH: path.join(NETWORK_DIR, 'config') },
    timeout: 180000,
  });
  if (chOut) console.log(`[createChannel:stdout] ${chOut}`);
  if (chErr) console.error(`[createChannel:stderr] ${chErr}`);

  console.log(`[provisioner] Deploying chaincode to ${channelName}...`);
  const deployCmd = [
    `"${NETWORK_DIR}/scripts/deployChaincode.sh"`,
    `"${channelName}"`,
    `"${mfgOrg.mspId}" "${mfgOrg.domain}" "${mfgOrg.peerName}" "${mfgOrg.peerPort}"`,
    `"${splrOrg.mspId}" "${splrOrg.domain}" "${splrOrg.peerName}" "${splrOrg.peerPort}"`,
  ].join(' \\\n  ');

  const { stdout: ccOut, stderr: ccErr } = await execAsync(deployCmd, {
    env: { ...process.env, NETWORK_DIR, FABRIC_CFG_PATH: path.join(NETWORK_DIR, 'config') },
    timeout: 300000,
  });
  if (ccOut) console.log(`[deployChaincode:stdout] ${ccOut}`);
  if (ccErr) console.error(`[deployChaincode:stderr] ${ccErr}`);

  console.log(`[provisioner] Channel ${channelName} is ready.`);
}

module.exports = {
  toMspId,
  toDomain,
  toFolderName,
  toChannelName,
  provisionOrg,
  createChannel,
};
