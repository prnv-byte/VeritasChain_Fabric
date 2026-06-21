import React, { createContext, useState, useCallback, useEffect } from 'react';

export const OrgContext = createContext();

export function OrgProvider({ children }) {
  const [orgs, setOrgs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/orgs');
      if (!response.ok) throw new Error('Failed to fetch orgs');
      const data = await response.json();
      setOrgs(data || []);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching orgs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChannels = useCallback(async (orgId) => {
    if (!orgId) return;
    try {
      const response = await fetch(`/channels?orgId=${orgId}`);
      if (!response.ok) throw new Error('Failed to fetch channels');
      const data = await response.json();
      setChannels(data || []);
      return data;
    } catch (err) {
      console.error('Error fetching channels:', err);
    }
  }, []);

  const requestChannel = useCallback(async (fromOrgId, toOrgId) => {
    try {
      const response = await fetch('/channels/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromOrgId, toOrgId }),
      });
      if (!response.ok) throw new Error('Failed to request channel');
      const data = await response.json();
      await fetchChannels(fromOrgId);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchChannels]);

  return (
    <OrgContext.Provider value={{
      orgs,
      channels,
      loading,
      error,
      fetchOrgs,
      fetchChannels,
      requestChannel,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrgs() {
  const context = React.useContext(OrgContext);
  if (!context) {
    throw new Error('useOrgs must be used within OrgProvider');
  }
  return context;
}
