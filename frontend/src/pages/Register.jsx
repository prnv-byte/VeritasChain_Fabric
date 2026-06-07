import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', type: '', whatTheyMake: '', address: '', contact: '',
  });
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(null);
  const [error,    setError]    = useState(null);

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const cleanName = form.name.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanName.length < 3) {
      setError('Name must contain at least 3 letters or digits. Remove special characters like dots, slashes, or symbols.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.registerOrg(form);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result);
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="page-center">
        <div className="page-content">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--success)' }}>
              Registration Submitted!
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text)' }}>{success.name}</strong> has been registered.
              <br />
              Fabric identity is being provisioned in the background.
            </p>
            <div className="card" style={{ background: 'var(--surface2)', marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>PROVISIONING DETAILS</p>
              <p><span style={{ color: 'var(--text-muted)' }}>MSP ID: </span><code>{success.mspId}</code></p>
              <p><span style={{ color: 'var(--text-muted)' }}>Status: </span>
                <span className="badge badge-provisioning">{success.fabricStatus}</span>
              </p>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Redirecting to login in 3 seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="page-content">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 22, textDecoration: 'none' }}>
            VeritasChain
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 12 }}>Register Organization</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Join the industrial blockchain marketplace
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input
                className="form-input"
                placeholder="e.g. Tata Motors, Steel Corp Ltd"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Organization Type</label>
              <select
                className="form-select"
                value={form.type}
                onChange={set('type')}
                required
              >
                <option value="">Select type...</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">What You Make / Supply</label>
              <input
                className="form-input"
                placeholder="e.g. EV batteries, Steel plates, Copper wire"
                value={form.whatTheyMake}
                onChange={set('whatTheyMake')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                className="form-input"
                placeholder="e.g. 123 Industrial Zone, Mumbai, MH"
                value={form.address}
                onChange={set('address')}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Number</label>
              <input
                className="form-input"
                type="tel"
                placeholder="e.g. +91-9876543210"
                value={form.contact}
                onChange={set('contact')}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16,
                color: 'var(--error)', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {loading ? <><span className="spinner" /> Registering...</> : 'Register Organization'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
