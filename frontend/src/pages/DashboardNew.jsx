import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Network, Loader, AlertCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicButton,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orgService, channelService } from '../services/api';
import '../styles/dashboard.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const { error, success } = useToast();
  
  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all orgs
        const orgsResponse = await orgService.getAll();
        setOrgs(orgsResponse.data);

        // Fetch channels for current user
        const channelsResponse = await channelService.getChannels(parsedUser.id);
        setChannels(channelsResponse.data);
      } catch (err) {
        error(err.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, error]);

  const handleCreateOrder = () => {
    if (channels.length === 0) {
      error('You need to establish a channel with another org first');
      return;
    }
    navigate('/orders/create');
  };

  const handleRequestChannel = (targetOrgId) => {
    if (!user) return;

    (async () => {
      try {
        const response = await channelService.requestChannel(user.id, targetOrgId);
        success('Channel request sent!');
        // Refresh channels
        const channelsResponse = await channelService.getChannels(user.id);
        setChannels(channelsResponse.data);
      } catch (err) {
        error(err.response?.data?.error || 'Failed to request channel');
      }
    })();
  };

  if (!user) return null;

  return (
    <Layout
      user={user}
      onLogout={() => localStorage.removeItem('user')}
      sidebarContent={
        <div className="sidebar-content-section">
          <h3 className="text-white/80 text-xs uppercase font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <GlassmorphicButton
              onClick={handleCreateOrder}
              size="sm"
              className="w-full"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create Order
            </GlassmorphicButton>
            <GlassmorphicButton
              onClick={() => navigate('/channels')}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              <Network className="w-4 h-4 inline mr-2" />
              Channels
            </GlassmorphicButton>
          </div>

          <h3 className="text-white/80 text-xs uppercase font-semibold mt-6 mb-3">Active Channels</h3>
          {channels.length === 0 ? (
            <p className="text-white/60 text-xs">No active channels yet</p>
          ) : (
            <div className="space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel._id}
                  className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs"
                >
                  <p className="text-white font-semibold mb-1">{channel.channelName}</p>
                  <p className="text-white/60 text-xs">
                    Status: <span className="text-green-400">{channel.status}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    >
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center items-center h-96"
          >
            <LoadingSpinner />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user.name}!</h1>
              <p className="text-white/70">Manage your organization and discover partners</p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard
                title="Active Channels"
                value={channels.length}
                icon="🔗"
              />
              <StatCard
                title="Total Organizations"
                value={orgs.length}
                icon="🏢"
              />
              <StatCard
                title="Status"
                value={user.fabricStatus === 'active' ? 'Active' : 'Setting Up'}
                icon={user.fabricStatus === 'active' ? '✓' : '⏳'}
              />
            </div>

            {/* Organizations Grid */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Available Organizations</h2>
              
              {orgs.length === 0 ? (
                <GlassmorphicCard>
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-white/50 mx-auto mb-4" />
                    <p className="text-white/70">No organizations found</p>
                  </div>
                </GlassmorphicCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orgs.map((org) => (
                    <OrgCard
                      key={org._id}
                      org={org}
                      isCurrentUser={org._id === user.id}
                      isConnected={channels.some(
                        (c) =>
                          (c.manufacturerOrgId._id === org._id ||
                            c.supplierOrgId._id === org._id) &&
                          c.status === 'active'
                      )}
                      onConnect={() => handleRequestChannel(org._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <GlassmorphicCard hoverable className="text-center">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-white/70 text-sm mb-1">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </GlassmorphicCard>
  );
}

function OrgCard({ org, isCurrentUser, isConnected, onConnect }) {
  if (org.fabricStatus === 'banned') return null;

  return (
    <GlassmorphicCard hoverable>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold text-lg truncate">{org.name}</h3>
          {isCurrentUser && (
            <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
              You
            </span>
          )}
        </div>
        <p className="text-white/70 text-sm capitalize mb-2">{org.type}</p>
      </div>

      <div className="space-y-2 mb-4">
        <InfoLine label="Status" value={org.fabricStatus} />
        <InfoLine label="Description" value={org.whatTheyMake} />
      </div>

      {!isCurrentUser && (
        <GlassmorphicButton
          onClick={onConnect}
          disabled={isConnected}
          variant={isConnected ? 'secondary' : 'primary'}
          size="sm"
          className="w-full text-xs"
        >
          {isConnected ? '✓ Connected' : 'Connect'}
        </GlassmorphicButton>
      )}
    </GlassmorphicCard>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="text-xs">
      <p className="text-white/60">{label}</p>
      <p className="text-white font-mono text-xs break-words">{value}</p>
    </div>
  );
}
