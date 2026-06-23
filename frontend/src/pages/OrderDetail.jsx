import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileSearch, Clock3, ClipboardList } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicButton,
  GlassmorphicInput,
  GlassmorphicTextarea,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orderService, channelService } from '../services/api';

function formatDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsText(file);
  });
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, success } = useToast();

  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fulfillState, setFulfillState] = useState({ batchID: '', proofFile: null, signalsFile: null });
  const [fulfilling, setFulfilling] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [runningVerify, setRunningVerify] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await channelService.getChannels(parsedUser.id);
        const availableChannels = response.data || [];
        setChannels(availableChannels);

        let foundOrder = null;
        let foundChannel = null;

        for (const channel of availableChannels) {
          try {
            const orderResponse = await orderService.getOrder(id, channel.channelName, parsedUser.mspId);
            const orderData = orderResponse.data;
            if (orderData && !orderData.error) {
              foundOrder = orderData;
              foundChannel = channel;
              break;
            }
          } catch (_err) {
            // try next channel
          }
        }

        if (!foundOrder) {
          error('Order not found in your channels.');
          return;
        }

        setOrder(foundOrder);
        setSelectedChannel(foundChannel);

        try {
          const historyResponse = await orderService.getOrderHistory(id, foundChannel.channelName, parsedUser.mspId);
          setHistory(historyResponse.data || []);
        } catch (_err) {
          setHistory([]);
        }
      } catch (err) {
        error(err.response?.data?.error || err.message || 'Unable to load order details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, error]);

  const orderChannelName = selectedChannel?.channelName || order?.channel || '';

  const handleFileChange = (field) => (event) => {
    const file = event.target.files?.[0] || null;
    setFulfillState((prev) => ({ ...prev, [field]: file }));
  };

  const handleFulfillSubmit = async (event) => {
    event.preventDefault();
    if (!order || !selectedChannel || !user) return;
    const { batchID, proofFile, signalsFile } = fulfillState;

    if (!proofFile || !signalsFile) {
      error('Please upload both proof.json and public.json.');
      return;
    }

    setFulfilling(true);
    try {
      const [zkProof, publicSignals] = await Promise.all([
        readFileAsText(proofFile),
        readFileAsText(signalsFile),
      ]);

      await orderService.fulfillOrder(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
        batchID: batchID || `BATCH-${Date.now()}`,
        zkProof,
        publicSignals,
      });

      success('Order fulfillment submitted.');
      setFulfillState({ batchID: '', proofFile: null, signalsFile: null });
      refreshOrder();
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Fulfillment failed.');
    } finally {
      setFulfilling(false);
    }
  };

  const handleRunVerify = async () => {
    if (!order || !selectedChannel || !user) return;
    setRunningVerify(true);
    try {
      const response = await orderService.runVerify(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
        manufacturerMSP: order.manufacturerMSP,
      });
      const result = response.data;
      if (result.error) {
        error(result.error);
      } else {
        setVerifyResult(result);
        success(result.valid ? 'Proof verified successfully' : 'Proof verification failed');
      }
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Verification failed.');
    } finally {
      setRunningVerify(false);
    }
  };

  const handleAccept = async () => {
    if (!order || !selectedChannel || !user) return;
    setSubmittingReject(true);
    try {
      await orderService.verifyOrder(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
      });
      success('Order accepted successfully.');
      refreshOrder();
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Accept failed.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleReject = async () => {
    if (!order || !selectedChannel || !user) return;
    if (!rejectReason.trim()) {
      error('Please provide a rejection reason.');
      return;
    }
    setSubmittingReject(true);
    try {
      await orderService.rejectOrder(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
        reason: rejectReason,
      });
      success('Order rejected successfully.');
      refreshOrder();
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Reject failed.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const refreshOrder = async () => {
    if (!order || !selectedChannel || !user) return;
    try {
      const response = await orderService.getOrder(order.orderID, orderChannelName, user.mspId);
      setOrder(response.data);
      const historyResponse = await orderService.getOrderHistory(order.orderID, orderChannelName, user.mspId);
      setHistory(historyResponse.data || []);
    } catch (_err) {
      // ignore refresh failures
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="space-y-6 py-16 text-center">
          <p className="text-white/70">Order details could not be loaded.</p>
          <GlassmorphicButton onClick={() => navigate('/orders')}>
            Back to Orders
          </GlassmorphicButton>
        </div>
      </Layout>
    );
  }

  const isManufacturer = user?.mspId === order.manufacturerMSP;
  const isSupplier = user?.mspId === order.supplierMSP;

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="text-blue-300 hover:text-white text-sm font-semibold"
            >
              ← Back to Orders
            </button>
            <h1 className="text-3xl font-bold text-white mt-3">Order Details</h1>
            <p className="text-white/70">Order ID: {order.orderID}</p>
          </div>
          <GlassmorphicButton onClick={() => navigate('/orders')}>
            Refresh
          </GlassmorphicButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <GlassmorphicCard className="p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm text-white/70 uppercase tracking-[0.2em]">Summary</p>
                  <h2 className="text-2xl font-bold text-white">{order.componentType}</h2>
                </div>
                <span className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] bg-white/10 text-white/80">
                  {order.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/70 mb-6">
                <div>
                  <p className="font-semibold text-white">Quantity</p>
                  <p>{order.quantity}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Deadline</p>
                  <p>{formatDate(order.deadline)}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Manufacturer</p>
                  <p>{order.manufacturerMSP}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Supplier</p>
                  <p>{order.supplierMSP}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/70">
                <div>
                  <p className="font-semibold text-white">Specifications</p>
                  <p className="whitespace-pre-line">{order.specifications}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Created</p>
                  <p>{formatDate(order.createdAt)}</p>
                </div>
                {order.fulfilledAt && (
                  <div>
                    <p className="font-semibold text-white">Fulfilled</p>
                    <p>{formatDate(order.fulfilledAt)}</p>
                  </div>
                )}
                {order.verifiedAt && (
                  <div>
                    <p className="font-semibold text-white">Verified</p>
                    <p>{formatDate(order.verifiedAt)}</p>
                  </div>
                )}
              </div>
            </GlassmorphicCard>

            <GlassmorphicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileSearch className="w-5 h-5 text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Order History</h3>
              </div>

              {history.length === 0 ? (
                <p className="text-white/60">No audit trail available for this order.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((entry, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2 text-sm text-white/70">
                        <span>{entry.txId || entry.transactionId || `Tx ${index + 1}`}</span>
                        <span>{formatDate(entry.timestamp || entry.time)}</span>
                      </div>
                      <div className="text-sm text-white/80">
                        <p className="font-semibold">{entry.type || entry.action || 'Update'}</p>
                        <pre className="whitespace-pre-wrap break-words text-xs text-white/60 mt-2">
                          {JSON.stringify(entry, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassmorphicCard>
          </div>

          <div className="space-y-6">
            <GlassmorphicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <ClipboardList className="w-5 h-5 text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Actions</h3>
              </div>

              {isSupplier && order.status === 'PENDING' && (
                <form onSubmit={handleFulfillSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Batch ID</label>
                    <GlassmorphicInput
                      value={fulfillState.batchID}
                      onChange={(e) => setFulfillState((prev) => ({ ...prev, batchID: e.target.value }))}
                      placeholder="Optional batch reference"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-2">ZK Proof (proof.json)</label>
                    <input
                      type="file"
                      accept="application/json"
                      onChange={handleFileChange('proofFile')}
                      className="w-full text-sm text-white/80"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/70 mb-2">Public Signals (public.json)</label>
                    <input
                      type="file"
                      accept="application/json"
                      onChange={handleFileChange('signalsFile')}
                      className="w-full text-sm text-white/80"
                    />
                  </div>

                  <GlassmorphicButton type="submit" loading={fulfilling} className="w-full">
                    Submit Fulfillment
                  </GlassmorphicButton>
                </form>
              )}

              {isManufacturer && order.status === 'FULFILLED' && (
                <div className="space-y-4">
                  <GlassmorphicButton
                    onClick={handleRunVerify}
                    loading={runningVerify}
                    className="w-full"
                  >
                    Run ZK Verification
                  </GlassmorphicButton>

                  {verifyResult && (
                    <div className={`rounded-2xl p-4 text-sm ${verifyResult.valid ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/20' : 'bg-rose-500/10 text-rose-200 border border-rose-400/20'}`}>
                      {verifyResult.valid ? 'Proof is valid.' : 'Proof is invalid.'}
                    </div>
                  )}

                  <div className="space-y-3">
                    <GlassmorphicButton onClick={handleAccept} loading={submittingReject} className="w-full">
                      Accept Fulfillment
                    </GlassmorphicButton>

                    <div>
                      <label className="block text-sm text-white/70 mb-2">Rejection Reason</label>
                      <GlassmorphicTextarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Why are you rejecting this fulfillment?"
                        rows={4}
                      />
                    </div>
                    <GlassmorphicButton
                      onClick={handleReject}
                      loading={submittingReject}
                      variant="secondary"
                      className="w-full"
                    >
                      Reject Fulfillment
                    </GlassmorphicButton>
                  </div>
                </div>
              )}

              {(!isSupplier || order.status !== 'PENDING') && (!isManufacturer || order.status !== 'FULFILLED') && (
                <p className="text-white/60 text-sm">No actions are available for this order at the moment.</p>
              )}
            </GlassmorphicCard>

            <GlassmorphicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock3 className="w-5 h-5 text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Channel</h3>
              </div>
              <p className="text-white/70 mb-2">{orderChannelName}</p>
              <GlassmorphicButton onClick={() => navigate('/channels')} variant="secondary" className="w-full">
                View My Channels
              </GlassmorphicButton>
            </GlassmorphicCard>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
