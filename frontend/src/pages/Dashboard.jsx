import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Discover from '../components/Discover';

export default function Dashboard() {
  const navigate = useNavigate();
  const [myOrg, setMyOrg] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loadingChs, setLoadingChs] = useState(false);
  const [orgCount, setOrgCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('vc_org');
    if (!raw) { navigate('/login'); return; }
    setMyOrg(JSON.parse(raw));
  }, [navigate]);

  const fetchChannels = useCallback(async () => {
    if (!myOrg) return;
    try {
      setLoadingChs(true);
      const data = await api.getMyChannels(myOrg.id);
      if (Array.isArray(data)) setChannels(data);
    } catch (_) {
      // silent fail on poll
    } finally {
      setLoadingChs(false);
    }
  }, [myOrg]);

  const fetchOrgCount = useCallback(async () => {
    try {
      const data = await api.getOrgs({ status: 'active' });
      if (Array.isArray(data)) setOrgCount(data.length);
    } catch (err) {
      setError(err.message || 'Unable to load organizations');
    }
  }, []);

  useEffect(() => {
    if (!myOrg) return;
    fetchChannels();
    fetchOrgCount();
    const interval = setInterval(fetchChannels, 5000);
    return () => clearInterval(interval);
  }, [myOrg, fetchChannels, fetchOrgCount]);

  function logout() {
    localStorage.removeItem('vc_org');
    navigate('/login');
  }

  if (!myOrg) return null;

  const partners = channels.map(ch => {
    const partner = ch.manufacturerOrgId?._id === myOrg.id ? ch.supplierOrgId : ch.manufacturerOrgId;
    return {
      id: ch._id,
      name: partner?.name || ch.channelName,
      status: ch.status,
      channelName: ch.channelName,
    };
  });

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar glass-card">
        <div className="profile-card">
          <div className="profile-avatar">{myOrg.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="profile-name">{myOrg.name}</div>
            <div className="profile-meta">{myOrg.type.toUpperCase()}</div>
            <div className="profile-detail">MSP ID</div>
            <div className="profile-value">{myOrg.mspId}</div>
          </div>
        </div>

        <div className="panel-divider" />

        <div className="partner-panel">
          <div className="panel-heading">Channel partners</div>
          {loadingChs ? (
            <p className="muted">Refreshing channels…</p>
          ) : partners.length === 0 ? (
            <p className="muted">No channels yet. Discover partners below.</p>
          ) : (
            <div className="partner-list">
              {partners.map(partner => (
                <div key={partner.id} className="partner-item">
                  <div>
                    <div className="partner-name">{partner.name}</div>
                    <div className="partner-subtitle">{partner.channelName}</div>
                  </div>
                  <span className={`badge badge-${partner.status || 'active'}`}>{partner.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-actions">
          <button className="btn btn-secondary" onClick={() => { fetchChannels(); fetchOrgCount(); }}>
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>Welcome back, {myOrg.name}</h1>
            <p>Explore all registered organizations and manage your channel relationships from one place.</p>
            {error && <div className="error-panel">{error}</div>}
          </div>

          <div className="stats-grid">
            <div className="stat-card glass-card">
              <div className="stat-label">Your channels</div>
              <div className="stat-value">{channels.length}</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-label">Active organizations</div>
              <div className="stat-value">{orgCount}</div>
            </div>
            <div className="stat-card glass-card">
              <div className="stat-label">Partner organizations</div>
              <div className="stat-value">{partners.length}</div>
            </div>
          </div>
        </div>

        <Discover myOrg={myOrg} channels={channels} onChannelCreated={fetchChannels} />
      </main>
    </div>
  );
}
