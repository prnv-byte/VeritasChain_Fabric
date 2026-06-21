import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassmorphicCard, GlassmorphicButton, LoadingSpinner } from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { adminService } from '../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [adminKey, setAdminKey] = useState(localStorage.getItem('vc_admin_key') || '');
  const [orgs, setOrgs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!adminKey) {
      navigate('/admin-login');
      return;
    }
    fetchData();
  }, [adminKey, navigate]);

  const fetchData = async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const [orgResponse, channelResponse] = await Promise.all([
        adminService.getAllOrgs(adminKey),
        adminService.getAllChannels(adminKey),
      ]);
      setOrgs(orgResponse.data || []);
      setChannels(channelResponse.data || []);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to load admin data');
      if (err.response?.status === 401) {
        localStorage.removeItem('vc_admin_key');
        navigate('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('vc_admin_key');
    navigate('/admin-login');
    success('Logged out successfully');
  };

  const handleBanOrg = async (org) => {
    if (!confirm(`Ban organization ${org.name}?`)) return;
    try {
      await adminService.banOrg(org._id, adminKey);
      success('Organization banned.');
      fetchData();
    } catch (err) {
      error(err.response?.data?.error || 'Unable to ban organization');
    }
  };

  const handleUnbanOrg = async (org) => {
    if (!confirm(`Restore access for ${org.name}?`)) return;
    try {
      await adminService.unbanOrg(org._id, adminKey);
      success('Organization restored.');
      fetchData();
    } catch (err) {
      error(err.response?.data?.error || 'Unable to restore organization');
    }
  };

  const handleDeleteOrg = async (org) => {
    if (!confirm(`Delete organization ${org.name}? This cannot be undone.`)) return;
    try {
      await adminService.deleteOrg(org._id, adminKey);
      success('Organization deleted.');
      fetchData();
    } catch (err) {
      error(err.response?.data?.error || 'Unable to delete organization');
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (!confirm(`Remove channel ${channel.channelName}?`)) return;
    try {
      await adminService.deleteChannel(channel._id, adminKey);
      success('Channel removed.');
      fetchData();
    } catch (err) {
      error(err.response?.data?.error || 'Unable to remove channel');
    }
  };

  if (loading) {
    return (
      <Layout user={null} onLogout={() => logout()}>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={null} onLogout={() => logout()}>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-white/70">Manage organizations and channels with platform-level controls.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <GlassmorphicButton onClick={fetchData} variant="secondary">Refresh</GlassmorphicButton>
            <GlassmorphicButton onClick={logout}>Logout</GlassmorphicButton>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 mb-6">
          <GlassmorphicCard className="p-6">
            <p className="text-white/70 text-sm mb-2">Organizations</p>
            <p className="text-3xl font-bold text-white">{orgs.length}</p>
          </GlassmorphicCard>
          <GlassmorphicCard className="p-6">
            <p className="text-white/70 text-sm mb-2">Channels</p>
            <p className="text-3xl font-bold text-white">{channels.length}</p>
          </GlassmorphicCard>
          <GlassmorphicCard className="p-6">
            <p className="text-white/70 text-sm mb-2">Banned Organizations</p>
            <p className="text-3xl font-bold text-white">{orgs.filter((o) => o.fabricStatus === 'banned').length}</p>
          </GlassmorphicCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassmorphicCard className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Organizations</h2>
            {orgs.length === 0 ? (
              <p className="text-white/70">No organizations available.</p>
            ) : (
              <div className="space-y-3">
                {orgs.map((org) => (
                  <div key={org._id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{org.name}</p>
                        <p className="text-white/60 text-sm">{org.mspId}</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.14em] text-white/70">{org.fabricStatus}</span>
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {org.fabricStatus === 'banned' ? (
                        <GlassmorphicButton size="sm" variant="secondary" onClick={() => handleUnbanOrg(org)}>
                          Restore
                        </GlassmorphicButton>
                      ) : (
                        <GlassmorphicButton size="sm" variant="secondary" onClick={() => handleBanOrg(org)}>
                          Ban
                        </GlassmorphicButton>
                      )}
                      <GlassmorphicButton size="sm" variant="danger" onClick={() => handleDeleteOrg(org)}>
                        Delete
                      </GlassmorphicButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassmorphicCard>

          <GlassmorphicCard className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Channels</h2>
            {channels.length === 0 ? (
              <p className="text-white/70">No channels available.</p>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div key={channel._id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{channel.channelName}</p>
                        <p className="text-white/60 text-sm">
                          {channel.manufacturerOrgId?.name || 'Manufacturer'} ↔ {channel.supplierOrgId?.name || 'Supplier'}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.14em] text-white/70">{channel.status}</span>
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <GlassmorphicButton size="sm" variant="danger" onClick={() => handleDeleteChannel(channel)}>
                        Remove
                      </GlassmorphicButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassmorphicCard>
        </div>
      </div>
    </Layout>
  );
}
