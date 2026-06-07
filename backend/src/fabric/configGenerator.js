'use strict';

const path = require('path');
const fs   = require('fs');

const NETWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'network');
const DOMAIN = 'veritaschain.com';

// Read orderer config from platform.json
const platform = JSON.parse(fs.readFileSync(path.join(NETWORK_DIR, 'config', 'platform.json')));
const orderer  = platform.orderer;

/**
 * Generate a configtx.yaml YAML string for a specific channel between two orgs.
 *
 * @param {string} channelName    - e.g. "ch-tatamotors-exide"
 * @param {object} mfgOrg         - Org document (manufacturer)
 * @param {object} splrOrg        - Org document (supplier)
 * @param {object} channelOrderer - Per-channel orderer: { name, hostname, port, tlsCertPath }
 * @returns {string}              - complete configtx.yaml content
 */
function generateChannelConfigtx(channelName, mfgOrg, splrOrg, channelOrderer) {
  // Profile name: "ch-voltride-battery" → "ChVoltrideB attery"
  const profile = channelName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

  // Anchor names used in YAML: only alphanumeric chars allowed in YAML anchors
  const mfgAnchor  = mfgOrg.name.replace(/[^a-zA-Z0-9]/g, '');
  const splrAnchor = splrOrg.name.replace(/[^a-zA-Z0-9]/g, '');

  return `---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: ${orderer.mspId}
    MSPDir: ${NETWORK_DIR}/organizations/ordererOrganizations/${DOMAIN}/msp
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
      - ${channelOrderer.hostname}:${channelOrderer.port}

  - &${mfgAnchor}Org
    Name: ${mfgAnchor}Org
    ID: ${mfgOrg.mspId}
    MSPDir: ${NETWORK_DIR}/organizations/peerOrganizations/${mfgOrg.domain}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${mfgOrg.mspId}.admin', '${mfgOrg.mspId}.peer', '${mfgOrg.mspId}.client')"
      Writers:
        Type: Signature
        Rule: "OR('${mfgOrg.mspId}.admin', '${mfgOrg.mspId}.client')"
      Admins:
        Type: Signature
        Rule: "OR('${mfgOrg.mspId}.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('${mfgOrg.mspId}.peer')"

  - &${splrAnchor}Org
    Name: ${splrAnchor}Org
    ID: ${splrOrg.mspId}
    MSPDir: ${NETWORK_DIR}/organizations/peerOrganizations/${splrOrg.domain}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${splrOrg.mspId}.admin', '${splrOrg.mspId}.peer', '${splrOrg.mspId}.client')"
      Writers:
        Type: Signature
        Rule: "OR('${splrOrg.mspId}.admin', '${splrOrg.mspId}.client')"
      Admins:
        Type: Signature
        Rule: "OR('${splrOrg.mspId}.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('${splrOrg.mspId}.peer')"

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
    - ${channelOrderer.hostname}:${channelOrderer.port}
  EtcdRaft:
    Consenters:
      - Host: ${channelOrderer.hostname}
        Port: ${channelOrderer.port}
        ClientTLSCert: ${channelOrderer.tlsCertPath}
        ServerTLSCert: ${channelOrderer.tlsCertPath}
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
        - <<: *${mfgAnchor}Org
          AnchorPeers:
            - Host: ${mfgOrg.peerName}.${mfgOrg.domain}
              Port: ${mfgOrg.peerPort}
        - <<: *${splrAnchor}Org
          AnchorPeers:
            - Host: ${splrOrg.peerName}.${splrOrg.domain}
              Port: ${splrOrg.peerPort}
      Capabilities: *ApplicationCapabilities
`;
}

/**
 * Write configtx.yaml to a temp directory and return the directory path.
 * The returned path is passed as $CONFIGTX_DIR to createChannel.sh.
 *
 * @param {string} channelName
 * @param {object} mfgOrg
 * @param {object} splrOrg
 * @param {object} channelOrderer - { name, hostname, port, tlsCertPath }
 * @returns {string} - path to temp dir containing configtx.yaml
 */
function writeChannelConfigtx(channelName, mfgOrg, splrOrg, channelOrderer) {
  const tmpDir = `/tmp/configtx-${channelName}`;
  fs.mkdirSync(tmpDir, { recursive: true });
  const yaml = generateChannelConfigtx(channelName, mfgOrg, splrOrg, channelOrderer);
  fs.writeFileSync(path.join(tmpDir, 'configtx.yaml'), yaml);
  return tmpDir;
}

module.exports = { writeChannelConfigtx, generateChannelConfigtx };
