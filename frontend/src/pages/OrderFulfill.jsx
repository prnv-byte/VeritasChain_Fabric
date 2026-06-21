import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { FormInput, FormTextarea } from '../components/Common/FormInputs';
import { GlassCard, LoadingSpinner, Toast } from '../components/Common/Common';

export default function OrderFulfill() {
  const navigate = useNavigate();
  const { org } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    batchID: '',
    vkURL: '',
    pfURL: '',
    srhURL: '',
    settingsURL: '',
    reason: '',
    action: 'fulfill',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!org?.id || !org?.mspId) {
      navigate('/login');
      return;
    }
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [org?.id, org?.mspId, navigate]);

  const fetchOrders = async () => {
    try {
      const data = await api.getAllOrders(org.mspId, org.mspId);
      if (Array.isArray(data)) {
        setOrders(data.filter(o => o.status === 'PENDING'));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (order) => {
    setSelectedOrder(order);
    setForm({ batchID: '', vkURL: '', pfURL: '', srhURL: '', settingsURL: '', reason: '', action: 'fulfill' });
    setShowModal(true);
  };

  const handleInputChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      if (form.action === 'fulfill') {
        await api.fulfillOrder(selectedOrder._id, {
          channel: selectedOrder.channel,
          mspId: org.mspId,
          batchID: form.batchID || undefined,
          vkURL: form.vkURL || undefined,
          pfURL: form.pfURL || undefined,
          srhURL: form.srhURL || undefined,
          settingsURL: form.settingsURL || undefined,
        });
        setToast({ message: 'Order fulfilled successfully', type: 'success' });
      } else if (form.action === 'reject') {
        await api.rejectOrder(selectedOrder._id, {
          channel: selectedOrder.channel,
          mspId: org.mspId,
          reason: form.reason,
        });
        setToast({ message: 'Order rejected', type: 'success' });
      }
      setShowModal(false);
      await fetchOrders();
    } catch (err) {
      setToast({ message: err.message || 'Failed to process order', type: 'error' });
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
    <div className="page-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2 text-gradient">Order Fulfillment</h1>
          <p className="text-slate-400">
            {orders.length === 0
              ? 'No pending orders to fulfill'
              : `${orders.length} pending order${orders.length !== 1 ? 's' : ''} awaiting fulfillment`}
          </p>
        </div>

        {orders.length === 0 ? (
          <GlassCard className="text-center py-12">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-slate-400">All caught up! No pending orders to fulfill.</p>
          </GlassCard>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => (
              <GlassCard key={order._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg mb-2">{order.componentType}</h3>
                  <div className="text-slate-400 text-sm space-y-1">
                    <p>Quantity: <span className="text-slate-200">{order.quantity} units</span></p>
                    <p>Deadline: <span className="text-slate-200">{order.deadline}</span></p>
                    <p className="line-clamp-2">Specs: <span className="text-slate-200">{order.specifications}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenModal(order)}
                  className="btn-glass px-6 py-2 font-semibold whitespace-nowrap"
                >
                  Fulfill Order
                </button>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {showModal && selectedOrder && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6">
              {form.action === 'fulfill' ? 'Fulfill Order' : 'Reject Order'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, action: 'fulfill' }))}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    form.action === 'fulfill'
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fulfill
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, action: 'reject' }))}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    form.action === 'reject'
                      ? 'bg-red-500 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Reject
                </button>
              </div>

              {form.action === 'fulfill' ? (
                <>
                  <FormInput
                    label="Batch ID (Optional)"
                    name="batchID"
                    value={form.batchID}
                    onChange={handleInputChange('batchID')}
                    placeholder="Batch identifier"
                  />
                  <FormInput
                    label="Virtual Key URL (Optional)"
                    name="vkURL"
                    value={form.vkURL}
                    onChange={handleInputChange('vkURL')}
                    placeholder="https://..."
                  />
                  <FormInput
                    label="Private Key URL (Optional)"
                    name="pfURL"
                    value={form.pfURL}
                    onChange={handleInputChange('pfURL')}
                    placeholder="https://..."
                  />
                  <FormInput
                    label="System Request Hash URL (Optional)"
                    name="srhURL"
                    value={form.srhURL}
                    onChange={handleInputChange('srhURL')}
                    placeholder="https://..."
                  />
                  <FormInput
                    label="Settings URL (Optional)"
                    name="settingsURL"
                    value={form.settingsURL}
                    onChange={handleInputChange('settingsURL')}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-slate-400">None of these fields are required.</p>
                </>
              ) : (
                <FormTextarea
                  label="Rejection Reason (Required)"
                  name="reason"
                  value={form.reason}
                  onChange={handleInputChange('reason')}
                  placeholder="Why are you rejecting this order?"
                  rows={4}
                  required
                />
              )}

              <div className="flex gap-3 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-glass-secondary flex-1 py-2 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2 font-semibold flex items-center justify-center gap-2 rounded-lg ${
                    form.action === 'fulfill'
                      ? 'btn-glass'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Processing...
                    </>
                  ) : form.action === 'fulfill' ? (
                    'Submit Fulfillment'
                  ) : (
                    'Reject Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
