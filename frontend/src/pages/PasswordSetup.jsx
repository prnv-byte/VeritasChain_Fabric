import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function PasswordSetup() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(searchParams.get('token') || '');
    setEmail(searchParams.get('email') || '');
  }, [searchParams]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (!token) {
      return setError('Missing password setup token.');
    }

    setLoading(true);
    try {
      const response = await api.passwordSetup({ token, password });
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(response.message || 'Password has been set successfully.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <div className="page-content">
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Set Your VeritasChain Password</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 22 }}>
            Use the link from your registration email to create your first password.
          </p>

          {email && (
            <p style={{ marginBottom: 16 }}>
              <strong>Email:</strong> {email}
            </p>
          )}

          {success ? (
            <div>
              <div style={{ background: 'rgba(16,185,129,0.12)', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                <p style={{ margin: 0, color: '#064e3b' }}>{success}</p>
              </div>
              <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                {loading ? 'Setting password...' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
