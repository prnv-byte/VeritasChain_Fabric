import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationContainer } from './components/NotificationContainer';
// New pages
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

// Keep old pages for now (for compatibility)
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import OrderCreate from './pages/OrderCreate';
import OrderFulfill from './pages/OrderFulfill';
import OrderVerify from './pages/OrderVerify';
import Admin from './pages/Admin';

// Import styles
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
      {/* Auth Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/org-setup-progress" element={<OrgSetupProgressPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/create"
        element={
          <ProtectedRoute>
            <OrderCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute>
            <OrderDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/channels"
        element={
          <ProtectedRoute>
            <ChannelsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requirements"
        element={
          <ProtectedRoute>
            <RequirementsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />

      {/* Old routes for compatibility */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/orders/fulfill" element={<OrderFulfill />} />
      <Route path="/orders/verify" element={<OrderVerify />} />
      <Route path="/admin" element={<Admin />} />

      {/* Catch-all */}
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
