import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, PackageSearch } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicButton,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orderService, channelService } from '../services/api';

export function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { error } = useToast();

  const channelQuery = new URLSearchParams(location.search).get('channel');

  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [filter, setFilter] = useState('all');

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

        // Fetch channels
        const channelsResponse = await channelService.getChannels(parsedUser.id);
        const activeChannels = channelsResponse.data.filter((c) => c.status === 'active');
        setChannels(activeChannels);

        if (activeChannels.length > 0) {
          const defaultChannel = channelQuery
            ? activeChannels.find((c) => c.channelName === channelQuery)
            : activeChannels[0];

          const channelToUse = defaultChannel || activeChannels[0];
          setSelectedChannel(channelToUse);

          const ordersResponse = await orderService.getOrders(
            channelToUse.channelName,
            parsedUser.mspId
          );
          setOrders(ordersResponse.data || []);
        }
      } catch (err) {
        error(err.response?.data?.error || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, error, channelQuery]);

  const handleChannelChange = async (channelId) => {
    const channel = channels.find((c) => c._id === channelId);
    setSelectedChannel(channel);

    try {
      const response = await orderService.getOrders(channel.channelName, user.mspId);
      setOrders(response.data || []);
      navigate(`/orders?channel=${encodeURIComponent(channel.channelName)}`, { replace: true });
    } catch (err) {
      error('Failed to load orders');
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <Layout
        user={user}
        onLogout={() => localStorage.removeItem('user')}
      >
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  return (
    <Layout
      user={user}
      onLogout={() => localStorage.removeItem('user')}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassmorphicCard className="elevated mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Orders Management</h1>
          <p className="text-white/70">View and manage your orders and fulfillments</p>
        </GlassmorphicCard>

        {/* Channel Selection */}
        {channels.length > 0 && (
          <GlassmorphicCard className="mb-4 p-4">
            <p className="text-xs uppercase text-white/40 font-semibold mb-2 tracking-widest">Channel</p>
            <div className="flex gap-2 flex-wrap">
              {channels.map((channel) => (
                <button
                  key={channel._id}
                  onClick={() => handleChannelChange(channel._id)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    selectedChannel?._id === channel._id
                      ? 'bg-indigo-500/30 border border-indigo-400/50 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {channel.channelName}
                </button>
              ))}
            </div>
          </GlassmorphicCard>
        )}

        {/* Filter Buttons */}
        <div className="flex gap-2 mb-6 flex-wrap items-center">
          <span className="text-xs uppercase text-white/40 font-semibold tracking-widest mr-1">Filter:</span>
          {['all', 'PENDING', 'FULFILLED', 'ACCEPTED', 'REJECTED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === status
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <GlassmorphicCard>
            <div className="text-center py-14">
              <PackageSearch className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50 text-sm mb-5">No orders found</p>
              <GlassmorphicButton onClick={() => navigate('/orders/create')}>
                Create First Order
              </GlassmorphicButton>
            </div>
          </GlassmorphicCard>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.orderID}
                  order={order}
                  userType={user.type}
                  onViewDetails={() => navigate(`/orders/${order.orderID}`)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}

function OrderCard({ order, userType, onViewDetails }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <GlassmorphicCard hoverable className="cursor-pointer" onClick={onViewDetails}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-white font-semibold">{order.componentType}</h3>
              <span className={`text-xs px-3 py-1 rounded-full border ${getStatusBadgeClass(order.status)}`}>
                {order.status}
              </span>
            </div>
            <p className="text-white/70 text-sm mb-2">Order: {order.orderID.substring(0, 16)}...</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-white/60">Quantity</p>
                <p className="text-white font-semibold">{order.quantity} units</p>
              </div>
              <div>
                <p className="text-white/60">Deadline</p>
                <p className="text-white font-semibold">{new Date(order.deadline).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-white/70 text-sm">View Details</span>
          </div>
        </div>
      </GlassmorphicCard>
    </motion.div>
  );
}

function getStatusBadgeClass(status) {
  const badges = {
    PENDING: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30',
    FULFILLED: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
    ACCEPTED: 'bg-green-500/20 text-green-200 border-green-400/30',
    REJECTED: 'bg-red-500/20 text-red-200 border-red-400/30',
    CANCELLED: 'bg-gray-500/20 text-gray-200 border-gray-400/30',
  };
  return badges[status] || badges.PENDING;
}
