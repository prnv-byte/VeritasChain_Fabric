import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, LayoutDashboard, GitBranch, ClipboardList, ShoppingCart } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/layout.css';

const NAV_LINKS = [
  { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/channels',     label: 'Channels',     Icon: GitBranch },
  { to: '/requirements', label: 'Requirements', Icon: ClipboardList },
  { to: '/orders',       label: 'Orders',       Icon: ShoppingCart },
];

export function Layout({ children, user, onLogout, sidebarContent }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="layout-wrapper">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.3 }}
            className="sidebar glass-card"
          >
            <div className="sidebar-header">
              <h2 className="text-white font-bold text-lg">VeritasChain</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden text-white hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile */}
            {user && (
              <div className="sidebar-user glass-card light">
                <div className="mb-2">
                  <p className="text-white text-xs uppercase opacity-75">Organization</p>
                  <p className="text-white font-semibold text-sm truncate">{user.name}</p>
                </div>
                <div className="mb-4">
                  <p className="text-white text-xs uppercase opacity-75">MSP ID</p>
                  <p className="text-white font-mono text-xs break-words">{user.mspId}</p>
                </div>
                <div className="border-t border-white/20 pt-2">
                  <p className="text-white text-xs uppercase opacity-75">Type</p>
                  <p className="text-white font-semibold text-sm capitalize">{user.type}</p>
                </div>
              </div>
            )}

            {/* Persistent Navigation */}
            <nav className="sidebar-nav">
              {NAV_LINKS.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} />
                    {label}
                  </span>
                </NavLink>
              ))}
            </nav>

            {/* Per-page custom content */}
            {sidebarContent && (
              <div className="sidebar-content">
                {sidebarContent}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="sidebar-logout glass-button w-full flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="main-content">
        <header className="header glass-card">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="header-toggle text-white hover:text-gray-200"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="header-title text-white font-bold">VeritasChain Platform</h1>
          <div className="header-spacer" />
        </header>

        <main className="main-scroll glass-container">
          {children}
        </main>
      </div>
    </div>
  );
}

export function CenteredLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {children}
      </motion.div>
    </div>
  );
}
