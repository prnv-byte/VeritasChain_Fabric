import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '../components/Layout';
import { GlassmorphicCard, GlassmorphicButton, LoadingSpinner } from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { channelService } from '../services/api';

export default function ChannelsPage() {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
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
        setChannels(response.data || []);
      } catch (err) {
        error(err.response?.data?.error || 'Failed to load channels');
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [navigate, error]);

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Channels</h1>
            <p className="text-white/70">Overview of your active and pending Fabric channels.</p>
          </div>
          <GlassmorphicButton onClick={() => navigate('/dashboard')} variant="secondary">
            Back to Dashboard
          </GlassmorphicButton>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-72">
            <LoadingSpinner />
          </div>
        ) : channels.length === 0 ? (
          <GlassmorphicCard className="p-8 text-center">
            <p className="text-white/70 mb-4">No channels found. Start by connecting with a partner organization.</p>
            <GlassmorphicButton onClick={() => navigate('/dashboard')}>Find Partners</GlassmorphicButton>
          </GlassmorphicCard>
        ) : (
          <div className="grid gap-4">
            {channels.map((channel) => (
              <GlassmorphicCard key={channel._id} className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{channel.channelName}</h2>
                    <p className="text-white/70 text-sm mt-1">Status: {channel.status}</p>
                    <p className="text-white/70 text-sm mt-1">
                      {channel.manufacturerOrgId?.name || 'Manufacturer'} ↔ {channel.supplierOrgId?.name || 'Supplier'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <GlassmorphicButton
                      onClick={() => navigate(`/orders?channel=${encodeURIComponent(channel.channelName)}`)}
                      variant="secondary"
                      size="sm"
                    >
                      View Orders
                    </GlassmorphicButton>
                    <GlassmorphicButton
                      onClick={() => navigate('/requirements')}
                      variant="primary"
                      size="sm"
                    >
                      View Requirements
                    </GlassmorphicButton>
                  </div>
                </div>
              </GlassmorphicCard>
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
