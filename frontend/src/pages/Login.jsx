import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('vc_org');
    if (session) {
      navigate('/dashboard');
      return;
    }
    fetchOrgs();
  }, [navigate]);

  async function fetchOrgs() {
    try {
      setLoading(true);
      const data = await api.getOrgs({ status: 'active' });
      if (Array.isArray(data)) setOrgs(data);
      else setError(data.error || 'Unable to load organizations');
    } catch (err) {
      setError(err.message || 'Unable to load organizations');
    } finally {
      setLoading(false);
    }
  }

  function findOrg(value) {
    const normalized = value.trim().toLowerCase();
    return orgs.find(org => {
      return [org._id, org.mspId, org.name, org.email]
        .some(field => typeof field === 'string' && field.toLowerCase() === normalized);
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Enter your organization identifier and password.');
      return;
    }

    const org = findOrg(identifier);
    if (!org) {
      setError('Organization not found. Enter a valid ID, MSP, name, or email.');
      return;
    }

    localStorage.setItem('vc_org', JSON.stringify({
      id: org._id,
      name: org.name,
      type: org.type,
      mspId: org.mspId,
      email: org.email || '',
    }));
    navigate('/dashboard');
  }

  return (
    <div className="page-center login-shell">
      <div className="glass-panel login-hero">
        <span className="eyebrow">VeritasChain</span>
        <h1>Secure Industrial Blockchain Access</h1>
        <p>Log in to your organization dashboard, manage channels, and connect with trusted partners.</p>
      </div>

      <div className="glass-card login-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Organization Login</h2>
          </div>
          <Link to="/register" className="btn btn-secondary">Register</Link>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 18 }}>
          <div className="form-group">
            <label className="form-label">Organization ID / MSP / Email</label>
            <input
              className="form-input"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Enter your organization identifier"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-panel">{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Sign In
          </button>
        </form>

        <div className="login-footer">
          <p className="muted">
            {loading ? 'Loading organizations…' : 'Use your organization name, MSP ID, or registered email. Password is required for UI access.'}
          </p>
        </div>

        <div className="org-list">
          <div className="list-title">Active organizations</div>
          {loading ? (
            <div className="muted">Fetching organizations…</div>
          ) : orgs.length === 0 ? (
            <div className="muted">No active organizations yet. Register one to get started.</div>
          ) : (
            <div className="org-pill-grid">
              {orgs.slice(0, 6).map(org => (
                <span key={org._id} className="org-pill">{org.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
