import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/Layout';
import { GlassmorphicCard, GlassmorphicButton, LoadingSpinner } from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import RequirementsPanel from '../components/RequirementsPanel';
import { channelService } from '../services/api';

export default function RequirementsPage() {
  const navigate = useNavigate();
  const { error } = useToast();
  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const fetchChannels = async () => {
      try {
        const response = await channelService.getChannels(parsedUser.id);
        const activeChannels = response.data || [];
        setChannels(activeChannels);
        if (activeChannels.length > 0) setSelectedChannel(activeChannels[0]);
      } catch (err) {
        error(err.response?.data?.error || 'Failed to load channels');
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [navigate, error]);

  const handleChannelSelect = useCallback((channelId) => {
    const channel = channels.find((c) => c._id === channelId);
    setSelectedChannel(channel || null);
  }, [channels]);

  if (loading) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Requirements</h1>
            <p className="text-white/70">View and manage channel requirements for ZK proof verification.</p>
          </div>
          <GlassmorphicButton onClick={() => navigate('/channels')} variant="secondary">
            Back to Channels
          </GlassmorphicButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <GlassmorphicCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select Channel</h2>
            {channels.length === 0 ? (
              <p className="text-white/70">You do not have any channels yet.</p>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <button
                    key={channel._id}
                    type="button"
                    onClick={() => handleChannelSelect(channel._id)}
                    className={`w-full text-left p-4 rounded-2xl transition ${selectedChannel?._id === channel._id ? 'bg-blue-500/20 border border-blue-400/30 text-white' : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    <div className="font-semibold">{channel.channelName}</div>
                    <div className="text-xs mt-1 text-white/60">{channel.status}</div>
                  </button>
                ))}
              </div>
            )}
          </GlassmorphicCard>

          <GlassmorphicCard className="p-6">
            {selectedChannel ? (
              <RequirementsPanel
                channel={selectedChannel}
                myOrg={user}
                showToast={(msg, type) => {
                  if (type === 'error') error(msg);
                }}
              />
            ) : (
              <div className="text-white/70 text-sm">
                Select a channel to load its requirements. Manufacturer organizations can set or update requirements here.
              </div>
            )}
          </GlassmorphicCard>
        </div>
      </motion.div>
    </Layout>
  );
}
