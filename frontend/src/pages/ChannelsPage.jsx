import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { GlassmorphicCard, GlassmorphicButton, LoadingSpinner } from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { channelService } from '../services/api';

export default function ChannelsPage() {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [user, setUser]       = useState(null);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetchChannels = useCallback(async (parsedUser) => {
    try {
      const response = await channelService.getChannels(parsedUser.id);
      setChannels(response.data || []);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { navigate('/login'); return; }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    fetchChannels(parsedUser);
  }, []); // run once on mount

  const handleAccept = async (channel) => {
    const myId  = user.id.toString();
    const isMfg = channel.manufacturerOrgId._id.toString() === myId;
    const other = isMfg ? channel.supplierOrgId : channel.manufacturerOrgId;
    try {
      await channelService.requestChannel(user.id, other._id);
      success(`Accepted! Channel with ${other.name} is being provisioned.`);
      fetchChannels(user);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to accept channel');
    }
  };

  const handleDecline = async (channelId) => {
    try {
      await channelService.declineChannel(channelId);
      success('Channel request declined.');
      fetchChannels(user);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to decline');
    }
  };

  const statusBadge = (status) => ({
    active:       'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    pending:      'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    provisioning: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    failed:       'bg-red-500/20 text-red-300 border-red-400/30',
    declined:     'bg-white/5 text-white/30 border-white/10',
  }[status] || 'bg-white/10 text-white/50 border-white/10');

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Channels</h1>
          <p className="text-white/70">Overview of your Fabric channels and incoming requests.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-72"><LoadingSpinner /></div>
        ) : channels.length === 0 ? (
          <GlassmorphicCard className="p-8 text-center">
            <p className="text-white/70 mb-4">No channels yet. Connect with a partner from the Dashboard.</p>
            <GlassmorphicButton onClick={() => navigate('/dashboard')}>Find Partners</GlassmorphicButton>
          </GlassmorphicCard>
        ) : (
          <div className="grid gap-4">
            {channels.map((channel) => {
              const myId   = user?.id?.toString();
              const isMfg  = channel.manufacturerOrgId?._id?.toString() === myId;
              const isSplr = channel.supplierOrgId?._id?.toString()     === myId;
              const myRole = isMfg ? 'Manufacturer' : 'Supplier';

              // Pending incoming = other side requested but I haven't
              const isPendingIncoming =
                channel.status === 'pending' &&
                ((isMfg && !channel.requestedByMfg) || (isSplr && !channel.requestedBySplr));

              const partnerOrg = isMfg ? channel.supplierOrgId : channel.manufacturerOrgId;

              return (
                <GlassmorphicCard key={channel._id} className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-semibold text-white">{channel.channelName}</h2>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusBadge(channel.status)}`}>
                          {channel.status}
                        </span>
                      </div>
                      <p className="text-white/60 text-sm">
                        Partner: <span className="text-white/80">{partnerOrg?.name}</span>
                        {' · '}Your role: <span className="text-indigo-300 font-medium">{myRole}</span>
                      </p>
                      {channel.status === 'pending' && !isPendingIncoming && (
                        <p className="text-yellow-400/80 text-xs mt-1">Waiting for {partnerOrg?.name} to accept…</p>
                      )}
                      {isPendingIncoming && (
                        <p className="text-yellow-300 text-xs mt-1 font-medium">
                          {partnerOrg?.name} has sent you a channel request
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-start">
                      {isPendingIncoming ? (
                        <>
                          <GlassmorphicButton size="sm" onClick={() => handleAccept(channel)}>
                            <CheckCircle className="w-4 h-4 inline mr-1" /> Accept
                          </GlassmorphicButton>
                          <GlassmorphicButton size="sm" variant="secondary" onClick={() => handleDecline(channel._id)}>
                            <XCircle className="w-4 h-4 inline mr-1" /> Decline
                          </GlassmorphicButton>
                        </>
                      ) : channel.status === 'active' ? (
                        <>
                          <GlassmorphicButton
                            onClick={() => navigate(`/orders?channel=${encodeURIComponent(channel.channelName)}`)}
                            variant="secondary" size="sm"
                          >
                            View Orders
                          </GlassmorphicButton>
                          {isMfg && (
                            <GlassmorphicButton
                              onClick={() => navigate('/requirements')}
                              variant="primary" size="sm"
                            >
                              Requirements
                            </GlassmorphicButton>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                </GlassmorphicCard>
              );
            })}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
