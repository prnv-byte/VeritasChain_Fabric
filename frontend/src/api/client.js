// VeritasChain API client — all requests proxy through Vite to localhost:3000

const BASE = '';

export const api = {
  // ── Orgs ────────────────────────────────────────────────────────────────────

  registerOrg: (data) =>
    fetch(`${BASE}/orgs/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  passwordSetup: (data) =>
    fetch(`${BASE}/auth/password-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  getOrgs: (params = {}) =>
    fetch(`${BASE}/orgs?` + new URLSearchParams(params)).then(r => r.json()),

  getOrg: (id) =>
    fetch(`${BASE}/orgs/${id}`).then(r => r.json()),

  getOrgByMsp: (mspId) =>
    fetch(`${BASE}/orgs/by-msp/${mspId}`).then(r => r.json()),

  // ── Channels ─────────────────────────────────────────────────────────────────

  requestChannel: (data) =>
    fetch(`${BASE}/channels/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  getMyChannels: (orgId) =>
    fetch(`${BASE}/channels?orgId=${orgId}`).then(r => r.json()),

  getChannel: (id) =>
    fetch(`${BASE}/channels/${id}`).then(r => r.json()),

  // ── Requirements ─────────────────────────────────────────────────────────────

  // Manufacturer calls this to post or update requirements on a channel.
  // data: { channel, mspId, componentType, globalRequirements, zkRanges, verificationKey }
  setRequirements: (data) =>
    fetch(`${BASE}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // Any channel member calls this to read requirements.
  getRequirements: (channel, mspId, manufacturerMSP) =>
    fetch(`${BASE}/requirements?${new URLSearchParams({ channel, mspId, manufacturerMSP })}`).then(r => r.json()),

  // ── Orders ──────────────────────────────────────────────────────────────────

  createOrder: (data) =>
    fetch(`${BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  getOrder: (id, channel, mspId) =>
    fetch(`${BASE}/orders/${id}?channel=${channel}&mspId=${mspId}`).then(r => r.json()),

  getAllOrders: (channel, mspId) =>
    fetch(`${BASE}/orders?channel=${encodeURIComponent(channel)}&mspId=${encodeURIComponent(mspId)}`).then(r => r.json()),

  getOrderHistory: (id, channel, mspId) =>
    fetch(`${BASE}/orders/${id}/history?channel=${channel}&mspId=${mspId}`).then(r => r.json()),

  // data: { channel, mspId, batchID, zkProof, publicSignals }
  // zkProof and publicSignals are the file contents from snarkjs as strings
  fulfillOrder: (id, data) =>
    fetch(`${BASE}/orders/${id}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // Manufacturer calls this to run snarkjs verification on the stored proof.
  // data: { channel, mspId, manufacturerMSP }
  // Returns { valid: true/false }
  runVerify: (id, data) =>
    fetch(`${BASE}/orders/${id}/run-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  verifyOrder: (id, data) =>
    fetch(`${BASE}/orders/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  rejectOrder: (id, data) =>
    fetch(`${BASE}/orders/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  cancelOrder: (id, data) =>
    fetch(`${BASE}/orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  submitFeedback: (id, data) =>
    fetch(`${BASE}/orders/${id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
};
