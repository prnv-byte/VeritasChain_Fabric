'use strict';

const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { orgs, peerForChannel, identityPaths } = require('../config/network');

// Cache open gRPC connections (one per peer address)
const connectionCache = new Map();

async function newGrpcConnection(peerAddress, tlsCertPath) {
  if (connectionCache.has(peerAddress)) {
    return connectionCache.get(peerAddress);
  }
  const tlsRootCert = fs.readFileSync(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  const connection = new grpc.Client(peerAddress, tlsCredentials, {
    'grpc.ssl_target_name_override': peerAddress.split(':')[0],
  });
  connectionCache.set(peerAddress, connection);
  return connection;
}

function readFirstFileInDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  if (!files.length) throw new Error(`No files in ${dirPath}`);
  return fs.readFileSync(path.join(dirPath, files[0]));
}

// Connect to Fabric Gateway for a given org + peer
async function getGateway(mspId, peerAlias) {
  const org = orgs[mspId];
  if (!org) throw new Error(`Unknown MSP: ${mspId}`);

  const peerConfig = org.peers[peerAlias] || Object.values(org.peers)[0];
  const { certPath, keyPath, tlsCert } = identityPaths(mspId, peerConfig.tlsCert);

  const client = await newGrpcConnection(peerConfig.address, tlsCert);

  const certPem = readFirstFileInDir(certPath);
  const keyPem  = readFirstFileInDir(keyPath);
  const privateKey = crypto.createPrivateKey(keyPem);

  const gateway = connect({
    client,
    identity: { mspId, credentials: certPem },
    signer: signers.newPrivateKeySigner(privateKey),
    hash: hash.sha256,
  });

  return gateway;
}

// Get a contract handle: { gateway, contract } — caller must close gateway when done
async function getContract(mspId, channelName, chaincodeName, peerAlias) {
  // If no peerAlias given, pick the peer that belongs to this channel
  const resolvedAlias = peerAlias
    || (peerForChannel[mspId] && peerForChannel[mspId][channelName])
    || undefined;
  const gateway = await getGateway(mspId, resolvedAlias);
  const network  = gateway.getNetwork(channelName);
  const contract = network.getContract(chaincodeName);
  return { gateway, contract };
}

module.exports = { getContract };
