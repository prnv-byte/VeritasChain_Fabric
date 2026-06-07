import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

export default function Discover({ myOrg, channels, onChannelCreated }) {
  const [orgs,     setOrgs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [toast,    setToast]    = useState(null);

  const fetchOrgs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOrgs({ status: 'active' });
      if (Array.isArray(data)) setOrgs(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Map each partner org ID → channel record
  const channelByOrgId = new Map();
  channels.forEach(ch => {
    const mfgId = ch.manufacturerOrgId?._id || ch.manufacturerOrgId;
    const splrId = ch.supplierOrgId?._id || ch.supplierOrgId;
    const partnerId = mfgId === myOrg.id ? splrId : mfgId;
    if (partnerId) channelByOrgId.set(partnerId, ch);
  });

  const filtered = orgs.filter(o => {
    if (o._id === myOrg.id) return false; // exclude self
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.whatTheyMake.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || o.type === filter;
    return matchSearch && matchFilter;
  });

  async function requestChannel(targetOrg) {
    try {
      const result = await api.requestChannel({
        fromOrgId: myOrg.id,
        toOrgId:   targetOrg._id,
      });
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(result.message || 'Channel request sent!', 'success');
        onChannelCreated && onChannelCreated();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Discover Organizations</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Find industrial partners and request private supply chain channels.
        </p>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          placeholder="Search by name or product..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="form-select"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="all">All Types</option>
          <option value="manufacturer">Manufacturers</option>
          <option value="supplier">Suppliers</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span className="spinner spinner-dark" />
          <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading organizations...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <p style={{ color: 'var(--text-muted)' }}>No organizations found.</p>
        </div>
      )}

      {/* Org grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(org => {
          const isOwnOrg    = org._id === myOrg.id;
          const ch          = channelByOrgId.get(org._id);
          const isActive    = ch?.status === 'active';
          const isFailed    = ch?.status === 'failed';
          const isPending   = ch?.status === 'pending' || ch?.status === 'provisioning';
          const iAmMfg      = ch && (ch.manufacturerOrgId?._id === myOrg.id || ch.manufacturerOrgId === myOrg.id);
          const iRequested  = ch && (iAmMfg ? ch.requestedByMfg : ch.requestedBySplr);
          const needsAccept = isPending && !iRequested;
          const canConnect  = !ch || isFailed;

          return (
            <div key={org._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Org header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, wordBreak: 'break-word' }}>
                    {org.name}
                    {isOwnOrg && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>(you)</span>}
                  </h3>
                  <span className={`badge badge-${org.type}`}>{org.type}</span>
                </div>
              </div>

              {/* Details */}
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><span style={{ color: 'var(--text)' }}>Makes: </span>{org.whatTheyMake}</div>
                <div><span style={{ color: 'var(--text)' }}>Address: </span>{org.address}</div>
              </div>

              {/* Action */}
              {!isOwnOrg && (
                <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                  {isActive ? (
                    <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✓</span> Channel active
                    </div>
                  ) : ch?.status === 'provisioning' && iRequested ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="spinner spinner-dark" style={{ width: 10, height: 10 }} /> Creating channel…
                    </div>
                  ) : needsAccept ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => requestChannel(org)}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Accept Channel Request
                    </button>
                  ) : isPending && iRequested ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      ⏳ Waiting for {org.name} to accept…
                    </div>
                  ) : canConnect ? (
                    <button
                      className={`btn btn-sm ${isFailed ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => requestChannel(org)}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {isFailed ? 'Retry Channel' : 'Request Channel'}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
