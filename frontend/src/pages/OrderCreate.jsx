import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { FormInput, FormSelect, FormTextarea } from '../components/Common/FormInputs';
import { GlassCard, LoadingSpinner, Toast } from '../components/Common/Common';

export default function OrderCreate() {
  const navigate = useNavigate();
  const { org } = useAuth();
  const [channels, setChannels] = useState([]);
  const [form, setForm] = useState({
    componentType: '',
    quantity: '',
    specifications: '',
    deadline: '',
    channel: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!org?.id) {
      navigate('/login');
      return;
    }
    fetchChannels();
  }, [org?.id, navigate]);

  const fetchChannels = async () => {
    try {
      const data = await api.getMyChannels(org.id);
      if (Array.isArray(data)) {
        setChannels(data.filter(ch => ch.status === 'active'));
      }
    } catch (err) {
      setToast({ message: 'Failed to load channels', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.componentType.trim()) newErrors.componentType = 'Component type is required';
    if (!form.quantity || parseInt(form.quantity) <= 0) newErrors.quantity = 'Quantity must be greater than 0';
    if (!form.specifications.trim()) newErrors.specifications = 'Specifications are required';
    if (!form.deadline) newErrors.deadline = 'Deadline is required';
    if (!form.channel) newErrors.channel = 'Please select a channel';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const channel = channels.find(ch => ch._id === form.channel);
      const supplierMSP = channel.manufacturerOrgId._id === org.id
        ? channel.supplierOrgId.mspId
        : channel.manufacturerOrgId.mspId;

      const result = await api.createOrder({
        manufacturerMSP: org.mspId,
        supplierMSP,
        componentType: form.componentType,
        quantity: parseInt(form.quantity),
        specifications: form.specifications,
        deadline: form.deadline,
        channel: form.channel,
      });

      setToast({ message: 'Order created successfully!', type: 'success' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create order', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2 text-gradient">Create Order</h1>
          <p className="text-slate-400">Submit a new component order to your supplier partners</p>
        </div>

        <GlassCard className="w-full">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormSelect
              label="Select Channel"
              name="channel"
              value={form.channel}
              onChange={handleInputChange('channel')}
              options={channels.map(ch => ({
                value: ch._id,
                label: `${ch.channelName} (${ch.manufacturerOrgId._id === org.id ? 'Supplier' : 'Manufacturer'})`,
              }))}
              placeholder="Choose a channel..."
              error={errors.channel}
              required
            />

            <FormInput
              label="Component Type"
              name="componentType"
              value={form.componentType}
              onChange={handleInputChange('componentType')}
              placeholder="e.g., EV Battery Pack, Copper Wire, Steel Plate"
              error={errors.componentType}
              required
            />

            <FormInput
              label="Quantity"
              name="quantity"
              type="number"
              value={form.quantity}
              onChange={handleInputChange('quantity')}
              placeholder="e.g., 100"
              error={errors.quantity}
              required
            />

            <FormTextarea
              label="Specifications & Requirements"
              name="specifications"
              value={form.specifications}
              onChange={handleInputChange('specifications')}
              placeholder="Detailed specs, quality standards, certifications needed, etc."
              error={errors.specifications}
              rows={5}
              required
            />

            <FormInput
              label="Delivery Deadline"
              name="deadline"
              type="date"
              value={form.deadline}
              onChange={handleInputChange('deadline')}
              error={errors.deadline}
              required
            />

            <div className="flex gap-3 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="btn-glass-secondary flex-1 py-3 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-glass flex-1 py-3 font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Creating...
                  </>
                ) : (
                  'Create Order'
                )}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
