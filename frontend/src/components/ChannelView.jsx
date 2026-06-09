import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import OrderCard from './OrderCard';

const DEMO_HASH = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';

export default function ChannelView({ channel, myOrg }) {
  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [toast,       setToast]       = useState(null);

  const mfgOrg  = channel.manufacturerOrgId;
  const splrOrg = channel.supplierOrgId;

  // Resolve org IDs (populated objects vs raw strings)
  const mfgId  = mfgOrg?._id  || mfgOrg;
  const splrId = splrOrg?._id || splrOrg;

  const isMfg  = myOrg.id === mfgId;
  const isSplr = myOrg.id === splrId;

  // The partner is always whoever is NOT the current user on this channel
  const partnerOrg  = isMfg ? splrOrg : mfgOrg;
  const partnerName = partnerOrg?.name || 'Partner';

  const fetchOrders = useCallback(async () => {
    if (channel.status !== 'active') return;
    try {
      setLoading(true);
      const data = await api.getAllOrders(channel.channelName, myOrg.mspId);
      if (Array.isArray(data)) setOrders(data);
    } catch (_) {
      // silent on poll errors
    } finally {
      setLoading(false);
    }
  }, [channel, myOrg.mspId]);

  // Poll orders every 5s
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  function showToast(msg, type = 'info') {
    const safeMsg = typeof msg === 'string' ? msg
      : Array.isArray(msg) ? msg.map(d => (typeof d === 'string' ? d : d.message || JSON.stringify(d))).join('; ')
      : String(msg);
    setToast({ msg: safeMsg, type });
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Channel header */}
      <div style={{
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16, flexShrink: 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{partnerName}</h2>
            <span className={`badge badge-${channel.status}`}>{channel.status}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            {channel.channelName} &nbsp;|&nbsp;
            {mfgOrg?.name || 'Manufacturer'} ↔ {splrOrg?.name || 'Supplier'}
          </p>
        </div>

        {/* New Order button — only manufacturer can create orders */}
        {channel.status === 'active' && isMfg && (
          <button className="btn btn-primary" onClick={() => setShowNewOrder(true)}>
            + New Order
          </button>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>

        {/* Waiting state */}
        {channel.status !== 'active' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 16, textAlign: 'center',
          }}>
            <span className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>
                {channel.status === 'provisioning'
                  ? 'Channel is being created...'
                  : 'Channel request pending'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 400 }}>
                {channel.status === 'provisioning'
                  ? 'Fabric channel and chaincode are being deployed. This takes ~2 minutes.'
                  : 'Waiting for the other organization to accept the channel request.'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12 }}>
                Status updates automatically every 5 seconds.
              </p>
            </div>
          </div>
        )}

        {/* Active channel: order list */}
        {channel.status === 'active' && (
          <>
            {loading && orders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <span className="spinner spinner-dark" />
                <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading orders...</p>
              </div>
            )}

            {!loading && orders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>No orders yet.</p>
                {isMfg && (
                  <button className="btn btn-primary" onClick={() => setShowNewOrder(true)}>
                    Create First Order
                  </button>
                )}
                {isSplr && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Waiting for manufacturer to create an order.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map(order => (
                <OrderCard
                  key={order.orderID}
                  order={order}
                  myOrg={myOrg}
                  channel={channel.channelName}
                  onUpdate={fetchOrders}
                  showToast={showToast}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrder && (
        <NewOrderModal
          channel={channel}
          myOrg={myOrg}
          partnerOrg={partnerOrg}
          onClose={() => setShowNewOrder(false)}
          onCreated={() => { setShowNewOrder(false); fetchOrders(); showToast('Order created!', 'success'); }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

// ── New Order Modal ──────────────────────────────────────────────────────────

function NewOrderModal({ channel, myOrg, partnerOrg, onClose, onCreated, showToast }) {
  const [form, setForm] = useState({
    componentType: '', quantity: '', specifications: '', deadline: '',
  });
  const [loading, setLoading] = useState(false);

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  // Default deadline = 30 days from now
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setForm(prev => ({ ...prev, deadline: d.toISOString().split('T')[0] }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const partnerMspId = partnerOrg?.mspId || partnerOrg;
      const result = await api.createOrder({
        manufacturerMSP: myOrg.mspId,   // submitter is always the manufacturer
        supplierMSP:     partnerMspId,  // partner is always the supplier
        componentType:   form.componentType,
        quantity:        parseInt(form.quantity, 10),
        specifications:  form.specifications,
        deadline:        new Date(form.deadline).toISOString(),
        channel:         channel.channelName,
      });
      if (result.error) showToast(result.error, 'error');
      else onCreated();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Create New Order</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Component Type</label>
            <input className="form-input" placeholder="e.g. Battery Pack, Steel Sheet"
              value={form.componentType} onChange={set('componentType')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input className="form-input" type="number" min="1" placeholder="e.g. 100"
              value={form.quantity} onChange={set('quantity')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Specifications</label>
            <textarea className="form-textarea"
              placeholder='e.g. {"capacity": "100kWh", "voltage": "400V"}'
              value={form.specifications} onChange={set('specifications')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Deadline</label>
            <input className="form-input" type="date"
              value={form.deadline} onChange={set('deadline')} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating...</> : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
