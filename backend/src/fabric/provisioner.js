'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const path  = require('path');
const crypto = require('crypto');
const fs   = require('fs');

const execAsync = promisify(exec);

const NETWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'network');
const DOMAIN = 'veritaschain.com';

// ── Name transforms ───────────────────────────────────────────────────────────


function toMspId(orgName) {
  let slug = orgName.trim().replace(/[^a-zA-Z0-9]/g, '');
  if (/^[^A-Za-z]/.test(slug)) slug = 'Org' + slug;
  const base = slug.substring(0, 10);
  const input = `${slug}|${process.env.PLATFORM_SECRET || 'veritas_default'}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
  return `${base}${hash}MSP`;
}


function toDomain(orgName) {
  let slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) slug = 'org';
  const base = slug.substring(0, 10);
  const input = `${slug}|${process.env.PLATFORM_SECRET || 'veritas_default'}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
  return `${base}${hash}.${DOMAIN}`;
}


function toFolderName(orgName) {
  return orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Generate a channel name from two org objects */
function toChannelName(mfgOrg, splrOrg) {
  // Take first 10 chars of each slug — keeps both org names visible in the channel
  // name while ensuring the orderer hostname stays under Linux's 64-char limit.
  // orderer-ch-{10}-{10}.veritaschain.com = 49 chars max.
  const mfgSlug  = (mfgOrg.slug || mfgOrg.name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const splrSlug = (splrOrg.slug || splrOrg.name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  return `ch-${mfgSlug}-${splrSlug}`;
}

// ── Docker helpers ────────────────────────────────────────────────────────────

/** Start a Fabric CA container for an org */
async function startCaContainer(org) {
  const folderName = org.domain.replace('.' + DOMAIN, '');
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

// ── Container restart helpers (used on backend startup after a machine reboot) ─

/** Returns true if a Docker container exists and is running */
async function isContainerRunning(name) {
  try {
    const { stdout } = await execAsync(`docker inspect --format '{{.State.Running}}' ${name} 2>/dev/null`);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Restart CA + peer containers for an already-provisioned org.
 * If peer crypto is missing or incomplete (e.g. after a wipe), re-enrolls
 * certs from the running CA before starting the peer container.
 * Safe to call even if containers are already running — skips them.
 */
async function restartOrgContainers(org) {
  const peerHost   = `${org.peerName}.${org.domain}`;
  const folderName = org.domain.replace('.' + DOMAIN, '');
  const caName     = `ca-${folderName}`;

  // Ensure CA is running first — peer enrollment needs it
  if (!await isContainerRunning(caName)) {
    console.log(`[restart] Starting CA container ${caName}...`);
    await startCaContainer(org);
    await new Promise(r => setTimeout(r, 5000));
  } else {
    console.log(`[restart] CA ${caName} already running, skipping.`);
  }

  // Check if peer crypto is complete (cacerts is the key folder configtxgen needs)
  const cacertsDir = path.join(
    NETWORK_DIR, 'organizations', 'peerOrganizations', org.domain, 'msp', 'cacerts'
  );
  const cryptoComplete = fs.existsSync(cacertsDir) && fs.readdirSync(cacertsDir).length > 0;

  if (!cryptoComplete) {
    // Crypto missing or wiped — re-enroll from the currently running CA.
    // Fix root-owned directories left by Docker before fabric-ca-client writes into them.
    console.log(`[restart] Peer crypto incomplete for ${org.name}, re-enrolling from CA...`);
    const orgDir = path.join(NETWORK_DIR, 'organizations', 'peerOrganizations', org.domain);
    if (fs.existsSync(orgDir)) {
      await execAsync(`docker run --rm -v "${orgDir}:/data" alpine chmod -R 777 /data`).catch(() => {});
    }
    const peerStr  = `${org.peerName}:${org.peerPort}`;
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
    if (stdout) console.log(`[restart:enroll:stdout] ${stdout}`);
    if (stderr) console.error(`[restart:enroll:stderr] ${stderr}`);
    console.log(`[restart] Peer crypto re-enrolled for ${org.name}.`);
  }

  if (!await isContainerRunning(peerHost)) {
    console.log(`[restart] Starting peer container ${peerHost}...`);
    await startPeerContainer(org);
  } else {
    console.log(`[restart] Peer ${peerHost} already running, skipping.`);
  }
}

/**
 * Restart the dedicated orderer container for an already-provisioned channel.
 * Crypto material must already exist on disk.
 * Safe to call even if the container is already running — skips it.
 */
async function restartChannelOrderer(channel) {
  if (!channel.ordererName || !channel.ordererPort || !channel.ordererAdminPort) {
    console.warn(`[restart] Channel ${channel.channelName} has no orderer info — skipping.`);
    return;
  }

  const ordererHost = channel.ordererName;
  if (await isContainerRunning(ordererHost)) {
    console.log(`[restart] Orderer ${ordererHost} already running, skipping.`);
    return;
  }

  console.log(`[restart] Starting orderer container ${ordererHost}...`);
  const ordererDir = path.join(NETWORK_DIR, 'organizations', 'ordererOrganizations', DOMAIN, 'orderers', ordererHost);
  const ledgerDir  = path.join(NETWORK_DIR, 'ledger', ordererHost);
  fs.mkdirSync(ledgerDir, { recursive: true });

  await execAsync(`docker rm -f ${ordererHost} 2>/dev/null || true`).catch(() => {});

  const cmd = [
    'docker run -d',
    `--name ${ordererHost}`,
    `--hostname ${ordererHost}`,
    '--network veritaschain',
    '-e FABRIC_LOGGING_SPEC=INFO',
    '-e ORDERER_GENERAL_LISTENADDRESS=0.0.0.0',
    `-e ORDERER_GENERAL_LISTENPORT=${channel.ordererPort}`,
    '-e ORDERER_GENERAL_LOCALMSPID=OrdererMSP',
    '-e ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp',
    '-e ORDERER_GENERAL_TLS_ENABLED=true',
    '-e ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key',
    '-e ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt',
    '-e ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]',
    '-e ORDERER_GENERAL_BOOTSTRAPMETHOD=none',
    '-e ORDERER_CHANNELPARTICIPATION_ENABLED=true',
    '-e ORDERER_ADMIN_TLS_ENABLED=true',
    '-e ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt',
    '-e ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key',
    '-e ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]',
    '-e ORDERER_ADMIN_TLS_CLIENTAUTHREQUIRED=true',
    '-e ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]',
    `-e ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:${channel.ordererAdminPort}`,
    `-p ${channel.ordererPort}:${channel.ordererPort}`,
    `-p ${channel.ordererAdminPort}:${channel.ordererAdminPort}`,
    `-v ${ordererDir}/msp:/var/hyperledger/orderer/msp`,
    `-v ${ordererDir}/tls:/var/hyperledger/orderer/tls`,
    `-v ${ledgerDir}:/var/hyperledger/production`,
    'hyperledger/fabric-orderer:2.5 orderer',
  ].join(' \\\n  ');

  await execAsync(cmd);
  // Wait for the orderer gRPC port to actually accept connections before returning
  console.log(`[restart] Orderer ${ordererHost} started on port ${channel.ordererPort}. Waiting for gRPC to be ready...`);
  await new Promise(r => setTimeout(r, 8000));
  console.log(`[restart] Orderer ${ordererHost} ready.`);
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
  if (!org || typeof org !== 'object') {
    throw new Error('provisionOrg requires an org object');
  }

  const peerName = org.peerName || 'peer0';
  const ccPort   = org.ccPort || (org.peerPort ? org.peerPort + 1 : undefined);

  if (!org.domain) {
    throw new Error('provisionOrg requires org.domain');
  }
  if (!org.caPort) {
    throw new Error('provisionOrg requires org.caPort');
  }
  if (!org.peerPort) {
    throw new Error('provisionOrg requires org.peerPort');
  }
  if (!ccPort) {
    throw new Error('provisionOrg requires org.ccPort or a valid org.peerPort');
  }
  if (!org.mspId) {
    throw new Error('provisionOrg requires org.mspId');
  }

  const folderName = org.domain.replace('.' + DOMAIN, '');
  const caName     = `ca-${folderName}`;

  console.log(`[provisioner] Starting CA container for ${org.name || org.slug}...`);
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
 * Create a channel between manufacturer and supplier with a dedicated per-channel orderer:
 *  1. Assign orderer ports and save to the Channel record
 *  2. Provision the orderer (enroll identity + start Docker container)
 *  3. Wait for orderer to be ready
 *  4. Generate per-channel configtx.yaml referencing this orderer
 *  5. Call createChannel.sh
 *  6. Call deployChaincode.sh
 *
 * @param {string} channelName
 * @param {object} mfgOrg    - plain object (from .toObject() or mongo doc)
 * @param {object} splrOrg   - plain object
 * @param {string} channelId - MongoDB _id of the Channel record (to save orderer info)
 */
async function createChannel(channelName, mfgOrg, splrOrg, channelId) {
  const { writeChannelConfigtx } = require('./configGenerator');
  const { assignOrdererPorts }   = require('./portManager');
  const Channel                  = require('../models/Channel');

  // 1. Assign unique ports for this channel's dedicated orderer
  const { port: ordererPort, adminPort: ordererAdminPort } = await assignOrdererPorts();
  const ordererName     = `orderer-${channelName}`;
  const ordererHostname = `${ordererName}.${DOMAIN}`;
  const ordererTlsCert  = path.join(
    NETWORK_DIR, 'organizations', 'ordererOrganizations', DOMAIN,
    'orderers', ordererHostname, 'tls', 'server.crt'
  );

  // Persist orderer info immediately so retries and dashboards can show it
  if (channelId) {
    await Channel.findByIdAndUpdate(channelId, {
      ordererName: ordererHostname,
      ordererPort,
      ordererAdminPort,
    });
  }

  // 2. Provision the per-channel orderer (enroll from CA + start Docker)
  console.log(`[provisioner] Provisioning orderer ${ordererHostname} (port ${ordererPort}, admin ${ordererAdminPort})...`);
  const provisionCmd = `"${NETWORK_DIR}/scripts/provisionChannelOrderer.sh" "${ordererName}" "${ordererPort}" "${ordererAdminPort}"`;
  const { stdout: pOut, stderr: pErr } = await execAsync(provisionCmd, {
    env: { ...process.env, NETWORK_DIR },
    timeout: 60000,
  });
  if (pOut) console.log(`[provisionOrderer:stdout] ${pOut}`);
  if (pErr) console.error(`[provisionOrderer:stderr] ${pErr}`);

  // 3. Wait for the orderer gRPC port to be ready
  console.log(`[provisioner] Waiting for orderer ${ordererHostname} to be ready...`);
  await new Promise(r => setTimeout(r, 8000));

  // 4. Generate per-channel configtx.yaml pointing at this orderer
  console.log(`[provisioner] Generating configtx for channel ${channelName}...`);
  const channelOrderer = { name: ordererName, hostname: ordererHostname, port: ordererPort, tlsCertPath: ordererTlsCert };
  const configtxDir    = writeChannelConfigtx(channelName, mfgOrg, splrOrg, channelOrderer);

  // 5. Create the channel on the per-channel orderer
  console.log(`[provisioner] Creating channel ${channelName}...`);
  const createCmd = [
    `"${NETWORK_DIR}/scripts/createChannel.sh"`,
    `"${channelName}"`,
    `"${mfgOrg.mspId}" "${mfgOrg.domain}" "${mfgOrg.peerName}" "${mfgOrg.peerPort}"`,
    `"${splrOrg.mspId}" "${splrOrg.domain}" "${splrOrg.peerName}" "${splrOrg.peerPort}"`,
    `"${configtxDir}"`,
    `"${ordererHostname}" "${ordererPort}" "${ordererAdminPort}"`,
  ].join(' \\\n  ');

  const { stdout: chOut, stderr: chErr } = await execAsync(createCmd, {
    env: { ...process.env, NETWORK_DIR, FABRIC_CFG_PATH: path.join(NETWORK_DIR, 'config') },
    timeout: 180000,
  });
  if (chOut) console.log(`[createChannel:stdout] ${chOut}`);
  if (chErr) console.error(`[createChannel:stderr] ${chErr}`);

  // 6. Deploy chaincode to the channel
  console.log(`[provisioner] Deploying chaincode to ${channelName}...`);
  const deployCmd = [
    `"${NETWORK_DIR}/scripts/deployChaincode.sh"`,
    `"${channelName}"`,
    `"${mfgOrg.mspId}" "${mfgOrg.domain}" "${mfgOrg.peerName}" "${mfgOrg.peerPort}"`,
    `"${splrOrg.mspId}" "${splrOrg.domain}" "${splrOrg.peerName}" "${splrOrg.peerPort}"`,
    `"${ordererHostname}" "${ordererPort}"`,
  ].join(' \\\n  ');

  const { stdout: ccOut, stderr: ccErr } = await execAsync(deployCmd, {
    env: { ...process.env, NETWORK_DIR, FABRIC_CFG_PATH: path.join(NETWORK_DIR, 'config') },
    timeout: 300000,
  });
  if (ccOut) console.log(`[deployChaincode:stdout] ${ccOut}`);
  if (ccErr) console.error(`[deployChaincode:stderr] ${ccErr}`);

  console.log(`[provisioner] Channel ${channelName} is ready with dedicated orderer ${ordererHostname}.`);
}

module.exports = {
  toMspId,
  toDomain,
  toFolderName,
  toChannelName,
  provisionOrg,
  createChannel,
  restartOrgContainers,
  restartChannelOrderer,
};
