import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Discover     from '../components/Discover';
import ChannelView  from '../components/ChannelView';

export default function Dashboard() {
  const navigate = useNavigate();
  const [myOrg,       setMyOrg]       = useState(null);
  const [channels,    setChannels]    = useState([]);
  const [view,        setView]        = useState('discover'); // 'discover' | channel._id
  const [loadingChs,  setLoadingChs]  = useState(false);

  // Load org from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('vc_org');
    if (!raw) { navigate('/login'); return; }
    setMyOrg(JSON.parse(raw));
  }, [navigate]);

  // Fetch channels (called on mount and every 5s)
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

  useEffect(() => {
    if (!myOrg) return;
    fetchChannels();
    const interval = setInterval(fetchChannels, 5000);
    return () => clearInterval(interval);
  }, [myOrg, fetchChannels]);

  function logout() {
    localStorage.removeItem('vc_org');
    navigate('/login');
  }

  if (!myOrg) return null;

  const activeChannel = view !== 'discover'
    ? channels.find(c => c._id === view)
    : null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Org identity */}
        <div style={{
          padding: '20px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800, fontSize: 16,
            marginBottom: 10, color: '#fff',
          }}>
            {myOrg.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, wordBreak: 'break-word' }}>
            {myOrg.name}
          </div>
          <span className={`badge badge-${myOrg.type}`}>{myOrg.type}</span>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {/* Discover nav item */}
          <SidebarItem
            label="Discover"
            icon="🔍"
            active={view === 'discover'}
            onClick={() => setView('discover')}
          />

          {/* My Channels section */}
          <div style={{
            padding: '16px 16px 6px', fontSize: 11, fontWeight: 600,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            My Channels {loadingChs && <span className="spinner spinner-dark" style={{ width: 10, height: 10 }} />}
          </div>

          {channels.length === 0 && (
            <div style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
              No channels yet
            </div>
          )}

          {channels.map(ch => {
            const partner = ch.manufacturerOrgId?._id === myOrg.id
              ? ch.supplierOrgId
              : ch.manufacturerOrgId;
            const partnerName = (partner && partner.name) ? partner.name : ch.channelName;
            return (
              <SidebarItem
                key={ch._id}
                label={partnerName}
                sublabel={ch.status}
                icon={ch.status === 'active' ? '💬' : '⏳'}
                active={view === ch._id}
                onClick={() => setView(ch._id)}
              />
            );
          })}
        </div>

        {/* Logout */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
          <button
            onClick={logout}
            style={{
              width: '100%', background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '8px', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {view === 'discover' ? (
          <Discover myOrg={myOrg} channels={channels} onChannelCreated={fetchChannels} />
        ) : activeChannel ? (
          <ChannelView channel={activeChannel} myOrg={myOrg} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: 'var(--text-muted)' }}>Channel not found.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function SidebarItem({ label, sublabel, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 16px', border: 'none',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-muted)',
        cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: active ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>
            {sublabel}
          </div>
        )}
      </div>
    </button>
  );
}
