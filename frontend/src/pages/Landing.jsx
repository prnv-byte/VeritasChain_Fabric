import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🔗',
    title: 'Connect',
    desc: 'Discover industrial partners on the blockchain marketplace. Request private channels with a single click.',
  },
  {
    icon: '✅',
    title: 'Verify',
    desc: 'ZK proof-based quality verification ensures every component meets specs before payment.',
  },
  {
    icon: '🔒',
    title: 'Trust',
    desc: 'Every transaction is immutable and transparent to channel members — no middlemen, no disputes.',
  },
];

export default function Landing() {
  return (
    <div className="landing-shell">
      <nav className="landing-nav glass-panel">
        <span className="brand">VeritasChain</span>
        <div className="nav-actions">
          <Link to="/register" className="btn btn-secondary">Register</Link>
          <Link to="/login" className="btn btn-primary">Login</Link>
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-copy glass-panel">
          <span className="eyebrow">Hyperledger Fabric 2.5</span>
          <h1>Industrial blockchain for trusted partners.</h1>
          <p>Move supply chain collaboration out of spreadsheets and into private channels with rich audit trails.</p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">Register Organization</Link>
            <Link to="/login" className="btn btn-secondary">Login</Link>
          </div>
        </div>
      </main>

      <section className="feature-grid">
        {features.map(f => (
          <div key={f.title} className="glass-card feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="landing-footer glass-panel">
        <p>VeritasChain — Phase 1 | Hyperledger Fabric 2.5</p>
        <Link to="/admin" className="footer-link">System Admin</Link>
      </footer>
    </div>
  );
}
