import React, { useState } from 'react';
import { api } from '../api/client';

// SHA-256 of the string "demo" — useful for testing
const DEMO_HASH = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';

const STATUS_BADGE = {
  PENDING:   'badge-pending',
  FULFILLED: 'badge-fulfilled',
  ACCEPTED:  'badge-accepted',
  REJECTED:  'badge-rejected',
  CANCELLED: 'badge-cancelled',
};

function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function shortId(id) {
  return id ? id.split('-').slice(-1)[0].toUpperCase() : '';
}

export default function OrderCard({ order, myOrg, channel, isMfg, isSplr, onUpdate, showToast }) {
  const [expanded,       setExpanded]       = useState(false);
  const [showFulfill,    setShowFulfill]    = useState(false);
  const [showFeedback,   setShowFeedback]   = useState(false);
  const [showReject,     setShowReject]     = useState(false);
  const [loading,        setLoading]        = useState(false);

  async function handleVerify() {
    setLoading(true);
    try {
      const r = await api.verifyOrder(order.orderID, { channel, mspId: myOrg.mspId });
      if (r.error) showToast(r.error, 'error');
      else { showToast('Order accepted!', 'success'); onUpdate(); }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="card" style={{ transition: 'border-color 0.15s' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--surface2)', padding: '2px 8px', borderRadius: 4,
        }}>
          #{shortId(order.orderID)}
        </div>

        <div style={{ fontWeight: 600, flex: 1 }}>{order.componentType}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Qty: {order.quantity}</div>

        <span className={`badge ${STATUS_BADGE[order.status] || 'badge-pending'}`}>
          {order.status}
        </span>

        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Timestamps row */}
      <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
        <small style={{ color: 'var(--text-muted)' }}>Created: {fmt(order.createdAt)}</small>
        {order.fulfilledAt && <small style={{ color: 'var(--text-muted)' }}>Fulfilled: {fmt(order.fulfilledAt)}</small>}
        {order.verifiedAt  && <small style={{ color: 'var(--text-muted)' }}>Verified: {fmt(order.verifiedAt)}</small>}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Detail label="Order ID"      value={order.orderID} mono />
          <Detail label="Manufacturer"  value={order.manufacturerMSP} />
          <Detail label="Supplier"      value={order.supplierMSP} />
          <Detail label="Specifications" value={order.specifications} />
          <Detail label="Deadline"      value={fmt(order.deadline)} />

          {order.batchID && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <Detail label="Batch ID"     value={order.batchID} />
              <Detail label="VK URL"       value={order.vkURL} link />
              <Detail label="PF URL"       value={order.pfURL} link />
              <Detail label="SRH URL"      value={order.srhURL} link />
              <Detail label="Settings URL" value={order.settingsURL} link />
              <Detail label="VK Hash"      value={order.vkHash} mono />
              <Detail label="PF Hash"      value={order.pfHash} mono />
              <Detail label="SRH Hash"     value={order.srhHash} mono />
              <Detail label="Settings Hash" value={order.settingsHash} mono />
            </>
          )}

          {order.verificationResult && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <Detail label="Verification" value={order.verificationResult} />
              {order.rejectionReason && <Detail label="Rejection Reason" value={order.rejectionReason} />}
              <Detail label="Verified By"  value={order.verifiedBy} />
            </>
          )}

          {order.feedbackText && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <Detail label="Feedback" value={order.feedbackText} />
              <Detail label="Feedback At" value={fmt(order.feedbackAt)} />
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {/* Supplier: Fulfill PENDING order */}
        {isSplr && order.status === 'PENDING' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowFulfill(true)}>
            Fulfill Order
          </button>
        )}

        {/* Manufacturer: Accept / Reject FULFILLED order */}
        {isMfg && order.status === 'FULFILLED' && (
          <>
            <button className="btn btn-success btn-sm" onClick={handleVerify} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Accept'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowReject(true)}>
              Reject
            </button>
          </>
        )}

        {/* Manufacturer: Feedback on ACCEPTED or REJECTED without feedback */}
        {isMfg && (order.status === 'ACCEPTED' || order.status === 'REJECTED') && !order.feedbackAt && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(true)}>
            Add Feedback
          </button>
        )}
      </div>

      {/* Modals */}
      {showFulfill && (
        <FulfillModal
          order={order}
          channel={channel}
          myOrg={myOrg}
          onClose={() => setShowFulfill(false)}
          onDone={() => { setShowFulfill(false); onUpdate(); showToast('Order fulfilled!', 'success'); }}
          showToast={showToast}
        />
      )}
      {showReject && (
        <RejectModal
          order={order}
          channel={channel}
          myOrg={myOrg}
          onClose={() => setShowReject(false)}
          onDone={() => { setShowReject(false); onUpdate(); showToast('Order rejected.', 'info'); }}
          showToast={showToast}
        />
      )}
      {showFeedback && (
        <FeedbackModal
          order={order}
          channel={channel}
          myOrg={myOrg}
          onClose={() => setShowFeedback(false)}
          onDone={() => { setShowFeedback(false); onUpdate(); showToast('Feedback submitted!', 'success'); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Detail row ───────────────────────────────────────────────────────────────

function Detail({ label, value, mono, link }) {
  if (!value) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'start' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, paddingTop: 1 }}>{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', fontSize: 13, wordBreak: 'break-all', textDecoration: 'none' }}>
          {value}
        </a>
      ) : (
        <span style={{
          fontSize: 13, wordBreak: 'break-all',
          fontFamily: mono ? 'monospace' : 'inherit',
          color: mono ? 'var(--text-muted)' : 'var(--text)',
        }}>
          {value}
        </span>
      )}
    </div>
  );
}

// ── Fulfill Modal ─────────────────────────────────────────────────────────────

function FulfillModal({ order, channel, myOrg, onClose, onDone, showToast }) {
  const [form, setForm] = useState({
    batchID: '', vkURL: '', pfURL: '', srhURL: '', settingsURL: '',
    vkHash: '', pfHash: '', srhHash: '', settingsHash: '',
  });
  const [loading, setLoading] = useState(false);

  function set(field) { return (e) => setForm(p => ({ ...p, [field]: e.target.value })); }

  function fillDemo() {
    setForm({
      batchID: `BATCH-${Date.now()}`,
      vkURL:      'https://demo-s3.example.com/batch/circuit.vk',
      pfURL:      'https://demo-s3.example.com/batch/proof.pf',
      srhURL:     'https://demo-s3.example.com/batch/signals.srh',
      settingsURL:'https://demo-s3.example.com/batch/settings.json',
      vkHash:     DEMO_HASH,
      pfHash:     DEMO_HASH,
      srhHash:    DEMO_HASH,
      settingsHash: DEMO_HASH,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.fulfillOrder(order.orderID, { channel, mspId: myOrg.mspId, ...form });
      if (r.error) showToast(r.error, 'error');
      else onDone();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3 className="modal-title">Fulfill Order #{shortId(order.orderID)}</h3>

        <div style={{
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          SHA-256 hashes must be 64 hex characters.
          <button className="btn btn-secondary btn-sm" onClick={fillDemo} style={{ marginLeft: 10 }}>
            Fill demo values
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {[
            { field: 'batchID',      label: 'Batch ID',     type: 'text',  placeholder: 'e.g. BATCH-001' },
            { field: 'vkURL',        label: 'VK URL',       type: 'url',   placeholder: 'https://...' },
            { field: 'pfURL',        label: 'PF URL',       type: 'url',   placeholder: 'https://...' },
            { field: 'srhURL',       label: 'SRH URL',      type: 'url',   placeholder: 'https://...' },
            { field: 'settingsURL',  label: 'Settings URL', type: 'url',   placeholder: 'https://...' },
            { field: 'vkHash',       label: 'VK Hash',      type: 'text',  placeholder: '64-char SHA-256 hex' },
            { field: 'pfHash',       label: 'PF Hash',      type: 'text',  placeholder: '64-char SHA-256 hex' },
            { field: 'srhHash',      label: 'SRH Hash',     type: 'text',  placeholder: '64-char SHA-256 hex' },
            { field: 'settingsHash', label: 'Settings Hash',type: 'text',  placeholder: '64-char SHA-256 hex' },
          ].map(({ field, label, type, placeholder }) => (
            <div className="form-group" key={field}>
              <label className="form-label">{label}</label>
              <input className="form-input" type={type} placeholder={placeholder}
                value={form[field]} onChange={set(field)} required />
            </div>
          ))}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Fulfilling...</> : 'Submit Fulfillment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ order, channel, myOrg, onClose, onDone, showToast }) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.rejectOrder(order.orderID, { channel, mspId: myOrg.mspId, reason });
      if (r.error) showToast(r.error, 'error');
      else onDone();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Reject Order #{shortId(order.orderID)}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Rejection Reason</label>
            <textarea className="form-textarea"
              placeholder="Explain why this order is being rejected..."
              value={reason} onChange={e => setReason(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? <><span className="spinner" /> Rejecting...</> : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Feedback Modal ────────────────────────────────────────────────────────────

function FeedbackModal({ order, channel, myOrg, onClose, onDone, showToast }) {
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.submitFeedback(order.orderID, { channel, mspId: myOrg.mspId, feedbackText: text });
      if (r.error) showToast(r.error, 'error');
      else onDone();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Add Feedback — #{shortId(order.orderID)}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Feedback is permanent and cannot be modified after submission.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Feedback</label>
            <textarea className="form-textarea" rows={4}
              placeholder="Enter your feedback about this delivery..."
              value={text} onChange={e => setText(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Submitting...</> : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function shortId(id) {
  return id ? id.split('-').slice(-1)[0].toUpperCase() : '';
}
