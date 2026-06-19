import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STATUS_COLOR = {
  active:       '#22c55e',
  banned:       '#ef4444',
  failed:       '#f97316',
  provisioning: '#a78bfa',
  pending:      '#64748b',
};

function adminFetch(path, options = {}) {
  const key = localStorage.getItem('vc_admin_key') || '';
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      ...(options.headers || {}),
    },
  }).then(r => r.json());
}

export default function Admin() {
  const [authed,   setAuthed]   = useState(!!localStorage.getItem('vc_admin_key'));
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [orgs,     setOrgs]     = useState([]);
  const [channels, setChannels] = useState([]);
  const [tab,      setTab]      = useState('orgs');
  const [toast,    setToast]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  React.useEffect(() => {
    if (authed) fetchAll();
  }, [authed]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        adminFetch('/admin/orgs'),
        adminFetch('/admin/channels'),
      ]);
      if (!Array.isArray(o)) { handleUnauth(); return; }
      setOrgs(o);
      setChannels(Array.isArray(c) ? c : []);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleUnauth() {
    localStorage.removeItem('vc_admin_key');
    setAuthed(false);
    setKeyError('Invalid admin key.');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setKeyError('');
    localStorage.setItem('vc_admin_key', keyInput);
    const res = await adminFetch('/admin/orgs');
    if (res.error) { handleUnauth(); return; }
    setOrgs(Array.isArray(res) ? res : []);
    setAuthed(true);
  }

  function logout() {
    localStorage.removeItem('vc_admin_key');
    setAuthed(false);
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function banOrg(org) {
    if (!confirm(`Ban "${org.name}"? They will lose platform access immediately.`)) return;
    const r = await adminFetch(`/admin/orgs/${org._id}/ban`, { method: 'POST' });
    if (r.error) showToast(r.error, 'error');
    else { showToast(r.message, 'success'); fetchAll(); }
  }

  async function unbanOrg(org) {
    if (!confirm(`Restore access for "${org.name}"?`)) return;
    const r = await adminFetch(`/admin/orgs/${org._id}/unban`, { method: 'POST' });
    if (r.error) showToast(r.error, 'error');
    else { showToast(r.message, 'success'); fetchAll(); }
  }

  async function evictOrg(org) {
    if (!confirm(`FULL EVICTION of "${org.name}"?\n\nThis will:\n- Remove them from all channels\n- Revoke their certificates\n- Stop their containers\n- Ban them from the platform\n\nThis cannot be undone.`)) return;
    showToast(`Evicting "${org.name}"... this may take 30s.`, 'info');
    const r = await adminFetch(`/admin/orgs/${org._id}`, { method: 'DELETE' });
    if (r.error) showToast(r.error, 'error');
    else { showToast(r.message, 'success'); fetchAll(); }
  }

  async function deleteChannel(ch) {
    if (!confirm(`Remove channel "${ch.channelName}" from platform?`)) return;
    const r = await adminFetch(`/admin/channels/${ch._id}`, { method: 'DELETE' });
    if (r.error) showToast(r.error, 'error');
    else { showToast(r.message, 'success'); fetchAll(); }
  }

  if (!authed) {
    return (
      <div className="page-center admin-shell">
        <div className="glass-panel admin-hero">
          <span className="eyebrow">Super admin access</span>
          <h1>Platform control center</h1>
          <p>Enter your admin key to view all registered organizations and inspect the channel topology.</p>
        </div>

        <div className="glass-card admin-card">
          <h2>Admin Sign In</h2>
          <p className="muted">Securely access the VeritasChain admin console.</p>

          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Admin Key</label>
              <input
                className="form-input"
                type="password"
                placeholder="Enter admin key..."
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                required
              />
              {keyError && <div className="error-panel">{keyError}</div>}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Login
            </button>
          </form>

          <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
            <Link to="/" style={{ color: 'var(--accent)' }}>← Back to platform</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell admin-dashboard">
      <div className="admin-header glass-panel">
        <div>
          <span className="eyebrow">Admin console</span>
          <h1>VeritasChain Superadmin</h1>
          <p>Manage organizations and channels in one secure dashboard.</p>
        </div>
        <div className="admin-actions">
          <button className="btn btn-secondary" onClick={fetchAll}>Refresh</button>
          <button className="btn btn-secondary" onClick={logout}>Logout</button>
          <Link to="/" className="btn btn-secondary">Platform</Link>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Total Orgs',    value: orgs.length },
          { label: 'Active Orgs',   value: orgs.filter(o => o.fabricStatus === 'active').length },
          { label: 'Banned Orgs',   value: orgs.filter(o => o.fabricStatus === 'banned').length },
        ].map(s => (
          <div key={s.label} className="stat-card glass-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card admin-tabs">
        <div className="tab-list">
          {['orgs', 'channels'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              {t === 'orgs' ? `Organizations (${orgs.length})` : `Channels (${channels.length})`}
            </button>
          ))}
        </div>

        {tab === 'orgs' && (
          <div className="admin-list">
            {loading && <p className="muted">Loading organizations...</p>}
            {!loading && orgs.length === 0 && <p className="muted">No orgs registered yet.</p>}
            {orgs.map(org => (
              <div key={org._id} className="admin-item">
                <div>
                  <div className="admin-item-title">{org.name}</div>
                  <div className="admin-item-meta">{org.mspId}</div>
                  <div className="admin-item-subtitle">{org.whatTheyMake}</div>
                </div>
                <div className="admin-item-actions">
                  {org.fabricStatus === 'banned' ? (
                    <button className="btn btn-success btn-sm" onClick={() => unbanOrg(org)}>
                      Restore
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => banOrg(org)}>
                        Ban
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => evictOrg(org)}>
                        Evict
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'channels' && (
          <div className="admin-list">
            {loading && <p className="muted">Loading channels...</p>}
            {!loading && channels.length === 0 && <p className="muted">No channels yet.</p>}
            {channels.map(ch => (
              <div key={ch._id} className="admin-item">
                <div>
                  <div className="admin-item-title">{ch.channelName}</div>
                  <div className="admin-item-meta">{ch.status}</div>
                </div>
                <div className="admin-item-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => deleteChannel(ch)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
