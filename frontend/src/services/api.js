import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth endpoints
export const authService = {
  login: (identifier, password) =>
    api.post('/orgs/login', { identifier, password }),
  
  register: (data) =>
    api.post('/orgs/register', data),
  
  setupPassword: (token, password) =>
    api.post('/auth/password-setup', { token, password }),

  getOrg: (id) =>
    api.get(`/orgs/${id}`),

  getOrgByMspId: (mspId) =>
    api.get(`/orgs/by-msp/${mspId}`),
};

// Org endpoints
export const orgService = {
  getAll: (filters = {}) =>
    api.get('/orgs', { params: filters }),

  getById: (id) =>
    api.get(`/orgs/${id}`),

  checkStatus: (id) =>
    api.get(`/orgs/${id}`),
};

// Channel endpoints
export const channelService = {
  requestChannel: (fromOrgId, toOrgId) =>
    api.post('/channels/request', { fromOrgId, toOrgId }),

  declineChannel: (id) =>
    api.post(`/channels/${id}/decline`),

  getChannels: (orgId) =>
    api.get('/channels', { params: { orgId } }),

  getChannel: (id) =>
    api.get(`/channels/${id}`),
};

// Channel Requirements (MongoDB-backed, Phase 3)
export const channelReqsService = {
  get:       (channelId)                    => api.get('/channel-reqs', { params: { channelId } }),
  save:      (channelId, params, batchRows) => api.post('/channel-reqs', { channelId, params, batchRows }),
  downloadPk: async (channelId) => {
    const res = await api.get('/channel-reqs/pk', { params: { channelId }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'circuit.pk';
    a.click();
    URL.revokeObjectURL(url);
  },
};

// Order endpoints
export const orderService = {
  createOrder: (data) =>
    api.post('/orders', data),

  getOrders: (channel, mspId) =>
    api.get('/orders', { params: { channel, mspId } }),

  getOrder: (id, channel, mspId) =>
    api.get(`/orders/${id}`, { params: { channel, mspId } }),

  getOrderHistory: (id, channel, mspId) =>
    api.get(`/orders/${id}/history`, { params: { channel, mspId } }),

  fulfillOrder: (id, formData) =>
    api.post(`/orders/${id}/fulfill`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  verifyOrder: (id, data) =>
    api.post(`/orders/${id}/verify`, data),

  rejectOrder: (id, data) =>
    api.post(`/orders/${id}/reject`, data),

  runVerify: (id, data) =>
    api.post(`/orders/${id}/run-verify`, data),

  cancelOrder: (id, data) =>
    api.post(`/orders/${id}/cancel`, data),

  submitFeedback: (id, data) =>
    api.post(`/orders/${id}/feedback`, data),
};

// Requirements endpoints
export const requirementsService = {
  setRequirements: (data) =>
    api.post('/requirements', data),

  getRequirements: (channel, mspId, manufacturerMSP) =>
    api.get('/requirements', { params: { channel, mspId, manufacturerMSP } }),
};

// Admin endpoints
export const adminService = {
  getAllOrgs: (adminKey) =>
    api.get('/admin/orgs', {
      headers: { Authorization: `Bearer ${adminKey}` },
    }),

  getAllChannels: (adminKey) =>
    api.get('/admin/channels', {
      headers: { Authorization: `Bearer ${adminKey}` },
    }),

  banOrg: (id, adminKey) =>
    api.post(`/admin/orgs/${id}/ban`, {}, {
      headers: { Authorization: `Bearer ${adminKey}` },
    }),

  unbanOrg: (id, adminKey) =>
    api.post(`/admin/orgs/${id}/unban`, {}, {
      headers: { Authorization: `Bearer ${adminKey}` },
    }),

  deleteOrg: (id, adminKey) =>
    api.delete(`/admin/orgs/${id}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    }),

  deleteChannel: (id, adminKey) =>
    api.delete(`/admin/channels/${id}`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    }),
};

export default api;
