import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [org, setOrg] = useState(() => {
    try {
      const saved = localStorage.getItem('vc_org');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.error('Error parsing org from localStorage:', err);
      localStorage.removeItem('vc_org');
      return null;
    }
  });

  const [adminKey, setAdminKey] = useState(() => {
    try {
      return localStorage.getItem('vc_admin_key') || null;
    } catch (err) {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (org) {
      localStorage.setItem('vc_org', JSON.stringify(org));
    } else {
      localStorage.removeItem('vc_org');
    }
  }, [org]);

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem('vc_admin_key', adminKey);
    } else {
      localStorage.removeItem('vc_admin_key');
    }
  }, [adminKey]);

  const login = useCallback(async (identifier, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/orgs/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      if (!response.ok) {
        let errorMsg = 'Login failed';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {
          // Response was not JSON
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setOrg(data);
      return data;
    } catch (err) {
      const errorMsg = err.message || 'Login failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setOrg(null);
    setError(null);
  }, []);

  const setAdminAuth = useCallback((key) => {
    setAdminKey(key);
  }, []);

  const logoutAdmin = useCallback(() => {
    setAdminKey(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      org,
      setOrg,
      adminKey,
      setAdminAuth,
      loading,
      error,
      login,
      logout,
      logoutAdmin,
      isAuthenticated: !!org,
      isAdmin: !!adminKey,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

