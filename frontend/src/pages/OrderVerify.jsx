import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { FormTextarea } from '../components/Common/FormInputs';
import { GlassCard, LoadingSpinner, Toast } from '../components/Common/Common';

export default function OrderVerify() {
  const navigate = useNavigate();
  const { org } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    feedback: '',
    action: 'accept',
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
        setOrders(data.filter(o => o.status === 'FULFILLED'));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (order) => {
    setSelectedOrder(order);
    setForm({ feedback: '', action: 'accept' });
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
      if (form.action === 'accept') {
        await api.verifyOrder(selectedOrder._id, {
          channel: selectedOrder.channel,
          mspId: org.mspId,
        });
        if (form.feedback.trim()) {
          await api.submitFeedback(selectedOrder._id, {
            channel: selectedOrder.channel,
            mspId: org.mspId,
            feedbackText: form.feedback,
          });
        }
        setToast({ message: 'Order accepted successfully', type: 'success' });
      } else {
        await api.rejectOrder(selectedOrder._id, {
          channel: selectedOrder.channel,
          mspId: org.mspId,
          reason: form.feedback || 'Fulfillment not satisfactory',
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
          <h1 className="text-3xl font-bold mb-2 text-gradient">Verify Fulfillment</h1>
          <p className="text-slate-400">
            {orders.length === 0
              ? 'No orders awaiting verification'
              : `${orders.length} fulfilled order${orders.length !== 1 ? 's' : ''} ready for review`}
          </p>
        </div>

        {orders.length === 0 ? (
          <GlassCard className="text-center py-12">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-slate-400">No fulfilled orders pending verification.</p>
          </GlassCard>
        ) : (
          <div className="grid gap-4">
            {orders.map(order => (
              <GlassCard key={order._id} className="flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">{order.componentType}</h3>
                  <div className="text-slate-400 text-sm space-y-1 mb-4">
                    <p>Quantity: <span className="text-slate-200">{order.quantity} units</span></p>
                    <p>Status: <span className="badge-fulfilled text-xs">FULFILLED</span></p>
                  </div>

                  {order.fulfillment && (
                    <div className="glass p-4 rounded-lg mb-4">
                      <h4 className="font-semibold text-sm mb-3">Fulfillment Details</h4>
                      <div className="text-sm space-y-2 text-slate-300">
                        {order.fulfillment.batchID && (
                          <p><span className="text-slate-400">Batch ID:</span> {order.fulfillment.batchID}</p>
                        )}
                        {order.fulfillment.vkURL && (
                          <p className="truncate">
                            <span className="text-slate-400">VK URL:</span>
                            <a href={order.fulfillment.vkURL} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 ml-2">
                              View
                            </a>
                          </p>
                        )}
                        {order.fulfillment.pfURL && (
                          <p className="truncate">
                            <span className="text-slate-400">PF URL:</span>
                            <a href={order.fulfillment.pfURL} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 ml-2">
                              View
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleOpenModal(order)}
                  className="btn-glass w-full py-2 font-semibold"
                >
                  Review & Accept/Reject
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
              {form.action === 'accept' ? 'Accept Fulfillment' : 'Reject Fulfillment'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, action: 'accept' }))}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    form.action === 'accept'
                      ? 'bg-green-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, action: 'reject' }))}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    form.action === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Reject
                </button>
              </div>

              <FormTextarea
                label={form.action === 'accept' ? 'Feedback (Optional)' : 'Rejection Reason (Required)'}
                name="feedback"
                value={form.feedback}
                onChange={handleInputChange('feedback')}
                placeholder={
                  form.action === 'accept'
                    ? 'Share feedback about the fulfillment (optional)...'
                    : 'Why are you rejecting this fulfillment?'
                }
                rows={4}
                required={form.action === 'reject'}
              />

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
                    form.action === 'accept'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Processing...
                    </>
                  ) : form.action === 'accept' ? (
                    'Accept Order'
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
