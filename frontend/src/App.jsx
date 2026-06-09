import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing   from './pages/Landing';
import Register  from './pages/Register';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin     from './pages/Admin';

// Simple auth guard: redirect to /login if no org in localStorage
function ProtectedRoute({ children }) {
  const org = localStorage.getItem('vc_org');
  if (!org) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Landing />}   />
      <Route path="/register"  element={<Register />}  />
      <Route path="/login"     element={<Login />}     />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/admin" element={<Admin />} />
      {/* Catch-all → landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
