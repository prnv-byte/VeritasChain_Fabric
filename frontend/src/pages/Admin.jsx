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

  useEffect(() => {
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
    localStorage.setItem('vc_admin_key', keyInput);
    const res = await adminFetch('/admin/orgs');
    if (res.error) { handleUnauth(); return; }
    setOrgs(Array.isArray(res) ? res : []);
    setAuthed(true);
    setKeyError('');
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

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>VeritasChain Admin</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
            Enter your admin key to access the control panel.
          </p>
          <form onSubmit={handleLogin}>
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
              {keyError && (
                <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 6 }}>{keyError}</p>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Login
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <Link to="/" style={{ color: 'var(--accent)' }}>← Back to platform</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Admin panel ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 22 }}>VeritasChain Admin</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Platform control panel — manage orgs and channels
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchAll}>Refresh</button>
          <button className="btn btn-secondary" onClick={logout}>Logout</button>
          <Link to="/" className="btn btn-secondary">← Platform</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Orgs',    value: orgs.length },
          { label: 'Active Orgs',   value: orgs.filter(o => o.fabricStatus === 'active').length },
          { label: 'Banned Orgs',   value: orgs.filter(o => o.fabricStatus === 'banned').length },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{s.value}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
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

      {/* Orgs tab */}
      {tab === 'orgs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}
          {!loading && orgs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No orgs registered yet.</p>
          )}
          {orgs.map(org => (
            <div key={org._id} className="card" style={{
              borderLeft: `3px solid ${STATUS_COLOR[org.fabricStatus] || '#64748b'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{org.name}</span>
                    <span className={`badge badge-${org.type}`}>{org.type}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: `${STATUS_COLOR[org.fabricStatus]}22`,
                      color: STATUS_COLOR[org.fabricStatus],
                      fontWeight: 600,
                    }}>
                      {org.fabricStatus}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{org.whatTheyMake}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{org.mspId}</p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {org.fabricStatus === 'banned' ? (
                    <button className="btn btn-success btn-sm" onClick={() => unbanOrg(org)}>
                      Restore Access
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => banOrg(org)}
                        style={{ borderColor: '#f97316', color: '#f97316' }}>
                        Ban
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => evictOrg(org)}>
                        Full Eviction
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Channels tab */}
      {tab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}
          {!loading && channels.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No channels yet.</p>
          )}
          {channels.map(ch => (
            <div key={ch._id} className="card" style={{
              borderLeft: `3px solid ${STATUS_COLOR[ch.status] || '#64748b'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{ch.channelName}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: `${STATUS_COLOR[ch.status]}22`,
                      color: STATUS_COLOR[ch.status],
                      fontWeight: 600,
                    }}>
                      {ch.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {ch.manufacturerOrgId?.name || 'Unknown'} ↔ {ch.supplierOrgId?.name || 'Unknown'}
                  </p>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => deleteChannel(ch)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
