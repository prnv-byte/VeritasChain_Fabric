import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicInput,
  GlassmorphicButton,
  GlassmorphicSelect,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orderService, channelService } from '../services/api';

export function OrderCreatePage() {
  const navigate = useNavigate();
  const { error, success } = useToast();

  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    channel: '',
    supplierMSP: '',
    componentType: '',
    quantity: '',
    deadline: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Fetch channels
    const fetchChannels = async () => {
      try {
        const response = await channelService.getChannels(parsedUser.id);
        const activeChannels = response.data.filter((c) => c.status === 'active');
        setChannels(activeChannels);
      } catch (err) {
        error('Failed to load channels');
      } finally {
        setLoadingChannels(false);
      }
    };

    fetchChannels();
  }, [navigate, error]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.channel) newErrors.channel = 'Please select a channel';
    if (!formData.supplierMSP) newErrors.supplierMSP = 'Please select a supplier';
    if (!formData.componentType.trim()) newErrors.componentType = 'Component type is required';
    if (!formData.quantity || formData.quantity <= 0) newErrors.quantity = 'Quantity must be greater than 0';
    if (!formData.deadline) newErrors.deadline = 'Deadline is required';

    // Check if deadline is in the future
    const deadlineDate = new Date(formData.deadline);
    if (deadlineDate <= new Date()) {
      newErrors.deadline = 'Deadline must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!user) return;

    setSubmitting(true);

    try {
      const selectedChannel = channels.find((c) => c._id === formData.channel);

      const orderData = {
        manufacturerMSP: user.mspId,
        supplierMSP: formData.supplierMSP,
        componentType: formData.componentType,
        quantity: parseInt(formData.quantity),
        deadline: formData.deadline,
        channel: selectedChannel.channelName,
      };

      const response = await orderService.createOrder(orderData);
      success('Order created successfully!');
      navigate('/orders', { state: { createdOrderId: response.data.orderID } });
    } catch (err) {
      error(err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (loadingChannels) {
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

  const selectedChannelData = channels.find((c) => c._id === formData.channel);
  const supplierOptions = selectedChannelData
    ? [
        {
          value: selectedChannelData.manufacturerOrgId._id === user.id
            ? selectedChannelData.supplierOrgId.mspId
            : selectedChannelData.manufacturerOrgId.mspId,
          label: selectedChannelData.manufacturerOrgId._id === user.id
            ? selectedChannelData.supplierOrgId.name
            : selectedChannelData.manufacturerOrgId.name,
        },
      ]
    : [];

  return (
    <Layout
      user={user}
      onLogout={() => localStorage.removeItem('user')}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <GlassmorphicCard className="elevated mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Create New Order</h1>
          <p className="text-white/70">Define your component requirements and delivery details</p>
        </GlassmorphicCard>

        <GlassmorphicCard className="elevated">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Channel Selection */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Channel *
              </label>
              <GlassmorphicSelect
                value={formData.channel}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    channel: e.target.value,
                    supplierMSP: '',
                  }));
                }}
                options={channels.map((c) => ({
                  value: c._id,
                  label: c.channelName,
                }))}
                error={!!errors.channel}
                errorMessage={errors.channel}
              />
            </div>

            {/* Supplier Selection */}
            {selectedChannelData && (
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Supplier *
                </label>
                <GlassmorphicSelect
                  value={formData.supplierMSP}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplierMSP: e.target.value }))}
                  options={supplierOptions}
                  error={!!errors.supplierMSP}
                  errorMessage={errors.supplierMSP}
                />
              </div>
            )}

            {/* Component Type */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Component Type *
              </label>
              <GlassmorphicInput
                type="text"
                placeholder="e.g., Lithium Battery, Semiconductor"
                value={formData.componentType}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, componentType: e.target.value }));
                  setErrors((prev) => ({ ...prev, componentType: '' }));
                }}
                error={!!errors.componentType}
                errorMessage={errors.componentType}
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Quantity *
              </label>
              <GlassmorphicInput
                type="number"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, quantity: e.target.value }));
                  setErrors((prev) => ({ ...prev, quantity: '' }));
                }}
                error={!!errors.quantity}
                errorMessage={errors.quantity}
                min="1"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Deadline *
              </label>
              <GlassmorphicInput
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, deadline: e.target.value }));
                  setErrors((prev) => ({ ...prev, deadline: '' }));
                }}
                error={!!errors.deadline}
                errorMessage={errors.deadline}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <GlassmorphicButton
                type="button"
                variant="secondary"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
              >
                Cancel
              </GlassmorphicButton>
              <GlassmorphicButton
                type="submit"
                disabled={submitting}
                loading={submitting}
                className="flex-1"
              >
                Create Order
              </GlassmorphicButton>
            </div>
          </form>
        </GlassmorphicCard>
      </motion.div>
    </Layout>
  );
}
