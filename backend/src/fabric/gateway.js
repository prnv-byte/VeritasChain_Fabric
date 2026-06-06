'use strict';

const grpc     = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const Org      = require('../models/Org');

const NETWORK_DIR = path.resolve(__dirname, '..', '..', '..', 'network');

// Cache open gRPC connections keyed by peer address (e.g. "localhost:7051")
const connectionCache = new Map();

/**
 * Create (or retrieve cached) gRPC connection to a peer.
 * @param {string} address       - e.g. "localhost:7051"
 * @param {string} tlsCertPath   - absolute path to peer's tls/ca.crt
 * @param {string} peerHostname  - e.g. "peer0.voltride.veritaschain.com"
 */
async function newGrpcConnection(address, tlsCertPath, peerHostname) {
  if (connectionCache.has(address)) return connectionCache.get(address);

  const tlsRootCert   = fs.readFileSync(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  const conn = new grpc.Client(address, tlsCredentials, {
    'grpc.ssl_target_name_override': peerHostname,
  });
  connectionCache.set(address, conn);
  return conn;
}

/**
 * Read the first file in a directory and return its content as a Buffer.
 */
function readFirstFile(dirPath) {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files in directory: ${dirPath}`);
  return fs.readFileSync(path.join(dirPath, files[0]));
}

/**
 * Connect to the Fabric Gateway for a given org, channel, and chaincode.
 * Looks up org config (domain, peerName, peerPort) from MongoDB.
 *
 * @param {string} mspId         - e.g. "VoltRideMSP"
 * @param {string} channelName   - e.g. "ch-voltride-battery"
 * @param {string} chaincodeName - e.g. "veritasorder"
 * @returns {{ gateway, contract }} - caller must call gateway.close() when done
 */
async function getContract(mspId, channelName, chaincodeName) {
  // Look up org from database
  const org = await Org.findOne({ mspId });
  if (!org) throw new Error(`Org with MSP ID "${mspId}" not found in database`);

  const peerHost   = `${org.peerName}.${org.domain}`;
  const orgDir     = path.join(NETWORK_DIR, 'organizations', 'peerOrganizations', org.domain);
  const tlsCertPath = path.join(orgDir, 'peers', peerHost, 'tls', 'ca.crt');
  const certPath   = path.join(orgDir, 'users', `Admin@${org.domain}`, 'msp', 'signcerts');
  const keyPath    = path.join(orgDir, 'users', `Admin@${org.domain}`, 'msp', 'keystore');

  const client = await newGrpcConnection(
    `localhost:${org.peerPort}`,
    tlsCertPath,
    peerHost,
  );

  const certPem    = readFirstFile(certPath);
  const keyPem     = readFirstFile(keyPath);
  const privateKey = crypto.createPrivateKey(keyPem);

  const gateway = connect({
    client,
    identity: { mspId, credentials: certPem },
    signer: signers.newPrivateKeySigner(privateKey),
    hash: hash.sha256,
  });

  const network  = gateway.getNetwork(channelName);
  const contract = network.getContract(chaincodeName);

  return { gateway, contract };
}

module.exports = { getContract };
