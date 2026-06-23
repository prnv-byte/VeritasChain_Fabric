import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormInput } from '../components/Common/FormInputs';
import { GlassCard, LoadingSpinner, Toast } from '../components/Common/Common';

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
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(!!localStorage.getItem('vc_admin_key'));
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [tab, setTab] = useState('orgs');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

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
      if (!Array.isArray(o)) {
        handleUnauth();
        return;
      }
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
    if (res.error) {
      handleUnauth();
      return;
    }
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
    else {
      showToast(r.message, 'success');
      fetchAll();
    }
  }

  async function unbanOrg(org) {
    if (!confirm(`Restore access for "${org.name}"?`)) return;
    const r = await adminFetch(`/admin/orgs/${org._id}/unban`, { method: 'POST' });
    if (r.error) showToast(r.error, 'error');
    else {
      showToast(r.message, 'success');
      fetchAll();
    }
  }

  async function evictOrg(org) {
    if (
      !confirm(
        `FULL EVICTION of "${org.name}"?\n\nThis will:\n- Remove them from all channels\n- Revoke their certificates\n- Stop their containers\n- Ban them from the platform\n\nThis cannot be undone.`
      )
    )
      return;
    showToast(`Evicting "${org.name}"... this may take 30s.`, 'info');
    const r = await adminFetch(`/admin/orgs/${org._id}`, { method: 'DELETE' });
    if (r.error) showToast(r.error, 'error');
    else {
      showToast(r.message, 'success');
      fetchAll();
    }
  }

  async function deleteChannel(ch) {
    if (!confirm(`Remove channel "${ch.channelName}" from platform?`)) return;
    const r = await adminFetch(`/admin/channels/${ch._id}`, { method: 'DELETE' });
    if (r.error) showToast(r.error, 'error');
    else {
      showToast(r.message, 'success');
      fetchAll();
    }
  }

  if (!authed) {
    return (
      <div className="login-shell">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md w-full">
          <GlassCard className="w-full">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2 text-gradient">Admin Console</h1>
              <p className="text-slate-400 text-sm">Superadmin platform access</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <FormInput
                label="Admin Key"
                name="adminKey"
                type="password"
                value={keyInput}
                onChange={e => {
                  setKeyInput(e.target.value);
                  setKeyError('');
                }}
                placeholder="Enter admin key"
                error={keyError}
                required
              />

              <button type="submit" className="w-full btn-glass py-3 font-semibold">
                Sign In
              </button>
            </form>

            <div className="border-t border-white/10 pt-4 mt-4 text-center">
              <Link to="/" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">
                ← Back to Platform
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gradient">VeritasChain Superadmin</h1>
          <p className="text-slate-400 mb-6">Manage organizations, channels, and platform security</p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="btn-glass px-6 py-2 font-semibold disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="btn-glass-secondary px-6 py-2 font-semibold"
            >
              Logout
            </button>
            <Link to="/" className="btn-glass-secondary px-6 py-2 font-semibold">
              Platform
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <GlassCard>
            <div className="text-slate-400 text-sm mb-2">Total Organizations</div>
            <div className="text-3xl font-bold">{orgs.length}</div>
          </GlassCard>
          <GlassCard>
            <div className="text-slate-400 text-sm mb-2">Active Organizations</div>
            <div className="text-3xl font-bold text-green-400">{orgs.filter(o => o.fabricStatus === 'active').length}</div>
          </GlassCard>
          <GlassCard>
            <div className="text-slate-400 text-sm mb-2">Total Channels</div>
            <div className="text-3xl font-bold">{channels.length}</div>
          </GlassCard>
        </div>

        {/* Tabs */}
        <GlassCard className="w-full">
          <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
            <button
              onClick={() => setTab('orgs')}
              className={`px-4 py-2 rounded font-semibold transition ${
                tab === 'orgs'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Organizations ({orgs.length})
            </button>
            <button
              onClick={() => setTab('channels')}
              className={`px-4 py-2 rounded font-semibold transition ${
                tab === 'channels'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Channels ({channels.length})
            </button>
          </div>

          {/* Organizations Tab */}
          {tab === 'orgs' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : orgs.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No organizations registered yet.</p>
              ) : (
                orgs.map(org => (
                  <div
                    key={org._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg mb-1">{org.name}</h3>
                      <div className="text-slate-400 text-sm space-y-1">
                        <p>MSP ID: {org.mspId}</p>
                        <p>Type: <span className={`badge-${org.type || 'supplier'} text-xs`}>{org.type}</span></p>
                        <p>Status: <span className={`badge-${org.fabricStatus} text-xs`}>{org.fabricStatus}</span></p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {org.fabricStatus === 'banned' ? (
                        <button
                          onClick={() => unbanOrg(org)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => banOrg(org)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold"
                          >
                            Ban
                          </button>
                          <button
                            onClick={() => evictOrg(org)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold"
                          >
                            Evict
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Channels Tab */}
          {tab === 'channels' && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : channels.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No channels yet.</p>
              ) : (
                channels.map(ch => (
                  <div
                    key={ch._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg mb-1">{ch.channelName}</h3>
                      <div className="text-slate-400 text-sm space-y-1">
                        <p>Manufacturer: {ch.manufacturerOrgId?.name || 'Unknown'}</p>
                        <p>Supplier: {ch.supplierOrgId?.name || 'Unknown'}</p>
                        <p>Status: <span className={`badge-${ch.status} text-xs`}>{ch.status}</span></p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteChannel(ch)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

