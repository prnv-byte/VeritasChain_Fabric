import React from 'react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/Common/Common';

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
  {
    icon: '⚡',
    title: 'Scale',
    desc: 'Enterprise-grade blockchain infrastructure built on Hyperledger Fabric with multi-channel support.',
  },
];

export default function Landing() {
  return (
    <div className="landing-shell">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Navigation */}
        <nav className="glass w-full max-w-6xl mx-auto px-8 py-4 rounded-2xl flex items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">VeritasChain</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Link to="/register" className="btn-glass-secondary px-6 py-2 font-semibold">
              Register
            </Link>
            <Link to="/login" className="btn-glass px-6 py-2 font-semibold">
              Login
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="w-full max-w-2xl mx-auto text-center mb-20">
          <div className="mb-6">
            <span className="eyebrow">Hyperledger Fabric 2.5</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Industrial Blockchain for <span className="text-gradient">Trusted Partners</span>
          </h1>
          <p className="text-slate-300 text-lg mb-8 leading-relaxed max-w-xl mx-auto">
            Move supply chain collaboration out of spreadsheets and into private channels with rich audit trails, immutable records, and zero-knowledge proofs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-glass px-8 py-3 font-semibold text-lg w-full sm:w-auto text-center">
              Register Organization
            </Link>
            <Link to="/login" className="btn-glass-secondary px-8 py-3 font-semibold text-lg w-full sm:w-auto text-center">
              Login to Dashboard
            </Link>
          </div>
        </main>

        {/* Features Grid */}
        <section className="feature-grid mb-20">
          {features.map(f => (
            <GlassCard key={f.title} className="feature-card flex flex-col">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </section>

        {/* Footer */}
        <footer className="glass w-full max-w-6xl mx-auto px-8 py-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <p>VeritasChain — Phase 2 | Hyperledger Fabric 2.5 | Enterprise Supply Chain</p>
          <Link to="/admin" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            System Admin
          </Link>
        </footer>
      </div>
    </div>
  );
}
