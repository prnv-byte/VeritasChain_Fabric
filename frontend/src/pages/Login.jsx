import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [orgs,    setOrgs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    fetchOrgs();
    const interval = setInterval(fetchOrgs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOrgs() {
    try {
      const data = await api.getOrgs({ status: 'active' });
      if (Array.isArray(data)) setOrgs(data);
      else setError(data.error || 'Failed to load organizations');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function selectOrg(org) {
    // Save to localStorage as the "logged-in" org
    localStorage.setItem('vc_org', JSON.stringify({
      id:    org._id,
      name:  org.name,
      type:  org.type,
      mspId: org.mspId,
    }));
    navigate('/dashboard');
  }

  const filtered = orgs.filter(o => {
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.whatTheyMake.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || o.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <Link to="/" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 22, textDecoration: 'none' }}>
          VeritasChain
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 12 }}>Select Your Organization</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Click on your organization to log in</p>
      </div>

      {/* Search + filter */}
      <div style={{
        display: 'flex', gap: 12, maxWidth: 700, margin: '0 auto 24px',
        flexWrap: 'wrap',
      }}>
        <input
          className="form-input"
          placeholder="Search organizations..."
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

      {/* Content */}
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span className="spinner spinner-dark" />
            <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Loading organizations...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius)', padding: '16px', color: 'var(--error)', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              {orgs.length === 0
                ? 'No active organizations yet. Register one first!'
                : 'No organizations match your search.'}
            </p>
            {orgs.length === 0 && (
              <Link to="/register" className="btn btn-primary" style={{ marginTop: 16 }}>
                Register Organization
              </Link>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(org => (
            <button
              key={org._id}
              onClick={() => selectOrg(org)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '18px 20px',
                textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background  = 'var(--surface2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background  = 'var(--surface)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{org.name}</span>
                    <span className={`badge badge-${org.type}`}>{org.type}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
                    {org.whatTheyMake}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{org.address}</p>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)', fontSize: 16, flexShrink: 0,
                }}>
                  →
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Phase note */}
      <p style={{
        textAlign: 'center', marginTop: 40, color: 'var(--text-muted)', fontSize: 12,
        opacity: 0.7,
      }}>
        Phase 1 — simplified org selection. Full authentication with JWT coming in Phase 2.
      </p>

      <p style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>
        Not registered yet?{' '}
        <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Register your organization
        </Link>
      </p>
    </div>
  );
}
