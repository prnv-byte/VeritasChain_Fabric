#!/usr/bin/env node
'use strict';

/**
 * VeritasChain config generator.
 * Reads network/config/platform.json and writes:
 *   - network/configtx/configtx.yaml
 *   - network/docker/docker-compose-ca.yaml
 *   - network/docker/docker-compose-network.yaml
 *   - network/config/platform.sh   (sourced by bash scripts)
 *
 * To add a new org or channel: edit platform.json, re-run this script,
 * then run startNetwork.sh. No other file needs to change.
 */

const fs   = require('fs');
const path = require('path');

const NETWORK_DIR = path.resolve(__dirname, '..');
const platform    = JSON.parse(fs.readFileSync(path.join(NETWORK_DIR, 'config', 'platform.json'), 'utf8'));

const { domain, orderer, organizations: orgs, channels, chaincode } = platform;

// ── helpers ───────────────────────────────────────────────────────────────────

function orgByMsp(mspId) {
  return orgs.find(o => o.mspId === mspId);
}

// "voltride-battery" → "VoltrideBattery"
function channelProfileName(channelName) {
  return channelName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// "VoltRideMSP" → "VoltRideOrg"
function mspToOrgAnchor(mspId) {
  return mspId.replace(/MSP$/, 'Org');
}

// ── 1. configtx.yaml ──────────────────────────────────────────────────────────

function orgBlock(org) {
  return `
  - &${org.name}Org
    Name: ${org.name}Org
    ID: ${org.mspId}
    MSPDir: ../organizations/peerOrganizations/${org.domain}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${org.mspId}.admin', '${org.mspId}.peer', '${org.mspId}.client')"
      Writers:
        Type: Signature
        Rule: "OR('${org.mspId}.admin', '${org.mspId}.client')"
      Admins:
        Type: Signature
        Rule: "OR('${org.mspId}.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('${org.mspId}.peer')"`;
}

function channelProfile(ch) {
  const mfgOrg  = orgByMsp(ch.manufacturer.mspId);
  const splrOrg = orgByMsp(ch.supplier.mspId);
  const mfgPeer = mfgOrg.peers.find(p => p.name === ch.manufacturer.peerName);
  const splrPeer= splrOrg.peers.find(p => p.name === ch.supplier.peerName);
  const profile = channelProfileName(ch.name);

  return `
  ${profile}:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
      Capabilities: *OrdererCapabilities
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - <<: *${mfgOrg.name}Org
          AnchorPeers:
            - Host: ${ch.manufacturer.peerName}.${mfgOrg.domain}
              Port: ${mfgPeer.port}
        - <<: *${splrOrg.name}Org
          AnchorPeers:
            - Host: ${ch.supplier.peerName}.${splrOrg.domain}
              Port: ${splrPeer.port}
      Capabilities: *ApplicationCapabilities`;
}

const configtxYaml = `---
Organizations:

  - &OrdererOrg
    Name: OrdererOrg
    ID: ${orderer.mspId}
    MSPDir: ../organizations/ordererOrganizations/${domain}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${orderer.mspId}.member')"
      Writers:
        Type: Signature
        Rule: "OR('${orderer.mspId}.member')"
      Admins:
        Type: Signature
        Rule: "OR('${orderer.mspId}.admin')"
    OrdererEndpoints:
      - ${orderer.name}.${domain}:${orderer.port}
${orgs.map(orgBlock).join('')}

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_5: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
  Capabilities:
    <<: *ApplicationCapabilities

Orderer: &OrdererDefaults
  OrdererType: etcdraft
  Addresses:
    - ${orderer.name}.${domain}:${orderer.port}
  EtcdRaft:
    Consenters:
      - Host: ${orderer.name}.${domain}
        Port: ${orderer.port}
        ClientTLSCert: ../organizations/ordererOrganizations/${domain}/orderers/${orderer.name}.${domain}/tls/server.crt
        ServerTLSCert: ../organizations/ordererOrganizations/${domain}/orderers/${orderer.name}.${domain}/tls/server.crt
  BatchTimeout: 2s
  BatchSize:
    MaxMessageCount: 10
    AbsoluteMaxBytes: 99 MB
    PreferredMaxBytes: 512 KB
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"
  Organizations:
  Capabilities:
    <<: *OrdererCapabilities

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ChannelCapabilities

Profiles:
${channels.map(channelProfile).join('')}
`;

// ── 2. docker-compose-ca.yaml ─────────────────────────────────────────────────

function caService(folderName, caName, caPort) {
  const svcName = caName.replace(/-/g, '_');  // ca-battery → ca_battery
  return `
  ${svcName}:
    image: hyperledger/fabric-ca:latest
    container_name: ${caName}
    environment:
      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
      - FABRIC_CA_SERVER_CA_NAME=${caName}
      - FABRIC_CA_SERVER_TLS_ENABLED=true
      - FABRIC_CA_SERVER_PORT=${caPort}
    ports:
      - "${caPort}:${caPort}"
    command: sh -c 'fabric-ca-server start -b admin:adminpw -d'
    volumes:
      - ../organizations/fabric-ca/${folderName}:/etc/hyperledger/fabric-ca-server
    networks:
      - veritaschain`;
}

const caYaml = `version: '3.7'

networks:
  veritaschain:

services:
${caService(orderer.folderName, orderer.caName, orderer.caPort)}
${orgs.map(o => caService(o.folderName, o.caName, o.caPort)).join('')}
`;

// ── 3. docker-compose-network.yaml ────────────────────────────────────────────

function ordererService() {
  const host = `${orderer.name}.${domain}`;
  return `
  ${host}:
    container_name: ${host}
    hostname: ${host}
    image: hyperledger/fabric-orderer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=${orderer.port}
      - ORDERER_GENERAL_LOCALMSPID=${orderer.mspId}
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_CHANNELPARTICIPATION_ENABLED=true
      - ORDERER_ADMIN_TLS_ENABLED=true
      - ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:${orderer.adminPort}
    working_dir: /root
    command: orderer
    ports:
      - ${orderer.port}:${orderer.port}
      - ${orderer.adminPort}:${orderer.adminPort}
    volumes:
      - ../organizations/ordererOrganizations/${domain}/orderers/${host}/msp:/var/hyperledger/orderer/msp
      - ../organizations/ordererOrganizations/${domain}/orderers/${host}/tls:/var/hyperledger/orderer/tls
      - ../ledger/${orderer.name}:/var/hyperledger/production
    networks:
      - veritaschain`;
}

function peerService(org, peer) {
  const host = `${peer.name}.${org.domain}`;
  return `
  ${host}:
    container_name: ${host}
    image: hyperledger/fabric-peer:2.5
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=${host}
      - CORE_PEER_ADDRESS=${host}:${peer.port}
      - CORE_PEER_LISTENADDRESS=0.0.0.0:${peer.port}
      - CORE_PEER_GOSSIP_BOOTSTRAP=${host}:${peer.port}
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=${host}:${peer.port}
      - CORE_PEER_LOCALMSPID=${org.mspId}
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_PEER_CHAINCODEADDRESS=${host}:${peer.ccPort}
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:${peer.ccPort}
    working_dir: /root
    command: peer node start
    ports:
      - ${peer.port}:${peer.port}
      - ${peer.ccPort}:${peer.ccPort}
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ../organizations/peerOrganizations/${org.domain}/peers/${host}/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/${org.domain}/peers/${host}/tls:/etc/hyperledger/fabric/tls
      - ../ledger/${host}:/var/hyperledger/production
    networks:
      - veritaschain
    extra_hosts:
      - "${host}:host-gateway"`;
}

const networkYaml = `version: '3.7'

networks:
  veritaschain:

services:
${ordererService()}
${orgs.flatMap(o => o.peers.map(p => peerService(o, p))).join('')}
`;

// ── 4. platform.sh ────────────────────────────────────────────────────────────

function platformSh() {
  const lines = [];

  lines.push(`# Auto-generated by generate.js — do not edit directly`);
  lines.push(`# Edit network/config/platform.json and re-run: node scripts/generate.js`);
  lines.push('');
  lines.push(`PLATFORM_DOMAIN="${domain}"`);
  lines.push(`CC_NAME="${chaincode.name}"`);
  lines.push(`CC_VERSION="${chaincode.version}"`);
  lines.push(`CC_SEQUENCE="${chaincode.sequence}"`);
  lines.push(`CC_PATH="${chaincode.path}"`);
  lines.push('');
  lines.push(`ORDERER_HOST="${orderer.name}"`);
  lines.push(`ORDERER_DOMAIN="${domain}"`);
  lines.push(`ORDERER_MSP_ID="${orderer.mspId}"`);
  lines.push(`ORDERER_PORT=${orderer.port}`);
  lines.push(`ORDERER_ADMIN_PORT=${orderer.adminPort}`);
  lines.push(`ORDERER_CA_PORT=${orderer.caPort}`);
  lines.push(`ORDERER_CA_NAME="${orderer.caName}"`);
  lines.push('');

  const orgFolders = orgs.map(o => o.folderName);
  lines.push(`ORGS=(${orgFolders.map(f => `"${f}"`).join(' ')})`);
  lines.push('');

  for (const org of orgs) {
    const k = org.folderName;
    lines.push(`ORG_${k}_MSP="${org.mspId}"`);
    lines.push(`ORG_${k}_DOMAIN="${org.domain}"`);
    lines.push(`ORG_${k}_CA_NAME="${org.caName}"`);
    lines.push(`ORG_${k}_CA_PORT=${org.caPort}`);
    const peerStr = org.peers.map(p => `${p.name}:${p.port}:${p.ccPort}`).join(' ');
    lines.push(`ORG_${k}_PEERS="${peerStr}"`);
    lines.push('');
  }

  // Channel defs: channelName:mfgMsp:mfgDomain:mfgPeerName:mfgPeerPort:splrMsp:splrDomain:splrPeerName:splrPeerPort
  const chDefs = channels.map(ch => {
    const mfgOrg  = orgByMsp(ch.manufacturer.mspId);
    const splrOrg = orgByMsp(ch.supplier.mspId);
    const mfgPeer = mfgOrg.peers.find(p => p.name === ch.manufacturer.peerName);
    const splrPeer= splrOrg.peers.find(p => p.name === ch.supplier.peerName);
    return [
      ch.name,
      ch.manufacturer.mspId, mfgOrg.domain, ch.manufacturer.peerName, mfgPeer.port,
      ch.supplier.mspId, splrOrg.domain, ch.supplier.peerName, splrPeer.port,
    ].join(':');
  });

  lines.push(`CHANNEL_DEFS=(`);
  for (const def of chDefs) {
    lines.push(`  "${def}"`);
  }
  lines.push(`)`);

  return lines.join('\n') + '\n';
}

// ── Write files ───────────────────────────────────────────────────────────────

fs.mkdirSync(path.join(NETWORK_DIR, 'configtx'), { recursive: true });
fs.mkdirSync(path.join(NETWORK_DIR, 'docker'),   { recursive: true });
fs.mkdirSync(path.join(NETWORK_DIR, 'config'),   { recursive: true });

fs.writeFileSync(path.join(NETWORK_DIR, 'configtx', 'configtx.yaml'), configtxYaml);
console.log('✔  network/configtx/configtx.yaml');

fs.writeFileSync(path.join(NETWORK_DIR, 'docker', 'docker-compose-ca.yaml'), caYaml);
console.log('✔  network/docker/docker-compose-ca.yaml');

fs.writeFileSync(path.join(NETWORK_DIR, 'docker', 'docker-compose-network.yaml'), networkYaml);
console.log('✔  network/docker/docker-compose-network.yaml');

fs.writeFileSync(path.join(NETWORK_DIR, 'config', 'platform.sh'), platformSh());
console.log('✔  network/config/platform.sh');

console.log(`\nGenerated config for ${orgs.length} orgs and ${channels.length} channels.`);
console.log('To add a new org: edit platform.json, re-run this script, then run startNetwork.sh');
