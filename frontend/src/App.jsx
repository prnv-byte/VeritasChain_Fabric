import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationContainer } from './components/NotificationContainer';
import { LoginPage } from './pages/LoginNew';
import { RegisterPage } from './pages/RegisterNew';
import { OrgSetupProgressPage } from './pages/OrgSetupProgressPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { DashboardPage } from './pages/DashboardNew';
import { OrderCreatePage } from './pages/OrderCreateNew';
import { OrdersPage } from './pages/OrdersNew';
import OrderDetail from './pages/OrderDetail';
import ChannelsPage from './pages/ChannelsPage';
import RequirementsPage from './pages/RequirementsPage';
import AdminDashboard from './pages/AdminDashboard';
import './styles/glassmorphism.css';
import './styles/layout.css';
import './styles/notifications.css';

function ProtectedRoute({ children }) {
  const user = localStorage.getItem('user');
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/org-setup-progress" element={<OrgSetupProgressPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/orders/create" element={<ProtectedRoute><OrderCreatePage /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
      <Route path="/channels" element={<ProtectedRoute><ChannelsPage /></ProtectedRoute>} />
      <Route path="/requirements" element={<ProtectedRoute><RequirementsPage /></ProtectedRoute>} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <NotificationContainer />
      <AppRoutes />
    </NotificationProvider>
  );
}
