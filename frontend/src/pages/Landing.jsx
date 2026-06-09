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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>VeritasChain</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/register" className="btn btn-secondary">Register</Link>
          <Link to="/login"    className="btn btn-primary">Login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 40px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 24,
          fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Hyperledger Fabric 2.5 — Phase 1
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1,
          marginBottom: 20, letterSpacing: '-0.02em',
        }}>
          VeritasChain
          <br />
          <span style={{ color: 'var(--accent)' }}>Industrial Marketplace</span>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.7, marginBottom: 40,
        }}>
          A blockchain-powered B2B platform for industrial supply chains.
          Private channels, ZK proof quality control, and tamper-evident order management.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>
            Register Organization
          </Link>
          <Link to="/login" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 15 }}>
            Login
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section style={{ padding: '60px 40px 80px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '20px 40px',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: 12,
      }}>
        VeritasChain — Phase 1 &nbsp;|&nbsp; Hyperledger Fabric 2.5 &nbsp;|&nbsp; Built on VeritasChain Platform
        &nbsp;|&nbsp;
        <Link to="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          System Admin
        </Link>
      </footer>
    </div>
  );
}
