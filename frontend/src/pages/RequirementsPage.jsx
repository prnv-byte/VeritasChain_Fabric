import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Download, RefreshCw, Lock, Edit3, Key, ChevronUp, ListPlus, Network } from 'lucide-react';
import { Layout } from '../components/Layout';
import { GlassmorphicCard, GlassmorphicButton, LoadingSpinner } from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { channelService, channelReqsService } from '../services/api';

function emptyRow() { return { name: '', value: '', unit: '', min: '', max: '' }; }

function ZkeyStatusBadge({ status, error: zkError }) {
  const styles = {
    none:       'bg-white/10 text-white/40 border-white/10',
    generating: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    ready:      'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    failed:     'bg-rose-500/20 text-rose-300 border-rose-400/30',
  };
  const labels = {
    none:       'No ZK keys',
    generating: 'Generating keys…',
    ready:      'ZK keys ready',
    failed:     'Key gen failed',
  };
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${styles[status] || styles.none}`}>
        {status === 'generating' && <RefreshCw size={10} className="animate-spin" />}
        {status === 'ready'      && <Key size={10} />}
        {labels[status] || status}
      </span>
      {status === 'failed' && zkError && (
        <span className="text-[10px] text-rose-400 font-mono max-w-[200px] truncate">{zkError}</span>
      )}
    </div>
  );
}

/* ─────────────── single channel card ─────────────── */
function ChannelReqCard({ channel, isMfg, onToast, autoOpen, cardRef }) {
  const { success, error } = onToast;
  const [reqs,     setReqs]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [rows,     setRows]     = useState([emptyRow()]);
  const [batchRows,setBatchRows]= useState(100);

  const pollRef = useRef(null);
  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  // auto-open edit form when parent triggers it (e.g. from bottom picker)
  useEffect(() => {
    if (autoOpen && !loading) openEdit();
  }, [autoOpen, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPoll = useCallback((chId) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res  = await channelReqsService.get(chId);
        const data = res.data;
        setReqs(data);
        if (data?.zkeyStatus !== 'generating') {
          stopPoll();
          if (data?.zkeyStatus === 'ready')  success('ZK keys generated!');
          if (data?.zkeyStatus === 'failed') error('ZK key generation failed. Check server logs.');
        }
      } catch {}
    }, 4000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    channelReqsService.get(channel._id)
      .then(res => {
        const data = res.data;
        setReqs(data || null);
        if (data?.zkeyStatus === 'generating') startPoll(channel._id);
      })
      .catch(() => setReqs(null))
      .finally(() => setLoading(false));
  }, [channel._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = () => {
    if (reqs?.params?.length) {
      setRows(reqs.params.map(p => ({ name: p.name || '', value: p.value || '', unit: p.unit || '', min: p.min || '', max: p.max || '' })));
      setBatchRows(reqs.batchRows || 100);
    } else {
      setRows([emptyRow()]);
      setBatchRows(100);
    }
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) { error('Add at least one parameter'); return; }
    if (!batchRows || batchRows < 1) { error('Batch size must be at least 1'); return; }
    setSaving(true);
    try {
      const res = await channelReqsService.save(channel._id, validRows, batchRows);
      setReqs(res.data);
      setEditing(false);
      success('Requirements saved! Generating ZK keys in background…');
      startPoll(channel._id);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to save requirements');
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (i, field, value) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addRow    = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const namedRows = rows.filter(r => r.name.trim());

  const partnerName = isMfg
    ? channel.supplierOrgId?.name
    : channel.manufacturerOrgId?.name;

  return (
    <div ref={cardRef} className="scroll-mt-6">
    <GlassmorphicCard className="p-0 overflow-hidden">
      {/* ── Card header ── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-white/3">
        <div>
          <p className="text-xs uppercase text-white/40 font-semibold tracking-widest mb-0.5">Channel</p>
          <h2 className="text-white font-bold text-lg leading-tight">{channel.channelName}</h2>
          <p className="text-white/50 text-xs mt-0.5">
            {isMfg ? 'Supplier' : 'Manufacturer'}: <span className="text-white/70">{partnerName}</span>
            {' · '}Your role: <span className="text-indigo-300 font-medium">{isMfg ? 'Manufacturer' : 'Supplier'}</span>
          </p>
        </div>
        <div className="shrink-0">
          {loading ? <LoadingSpinner /> : reqs ? (
            <ZkeyStatusBadge status={reqs.zkeyStatus} error={reqs.zkeyError} />
          ) : (
            <span className="text-xs text-white/30 border border-white/10 rounded-full px-2.5 py-1">No requirements</span>
          )}
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : !reqs ? (
          /* no requirements yet */
          <div className={`rounded-xl p-5 text-sm ${isMfg ? 'bg-white/5 border border-white/10' : 'bg-yellow-500/10 border border-yellow-500/25'}`}>
            {isMfg
              ? <p className="text-white/50">No requirements set yet. Click <strong className="text-white">Set Requirements</strong> below to configure.</p>
              : <p className="text-yellow-300">The manufacturer hasn't set requirements yet. Check back later.</p>
            }
          </div>
        ) : (
          /* requirements exist — compact read-only table */
          <div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr>
                  {(isMfg
                    ? ['Parameter', 'Target Value', 'Unit', 'Min', 'Max']
                    : ['Parameter', 'Target Value', 'Unit']
                  ).map(h => (
                    <th key={h} className="text-left text-xs uppercase text-white/40 font-semibold pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reqs.params.map((p, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="py-2.5 pr-4 text-white font-medium">{p.name}</td>
                    <td className="py-2.5 pr-4 text-white/70">{p.value || '—'}</td>
                    <td className="py-2.5 pr-4 text-white/50">{p.unit || '—'}</td>
                    {isMfg && <>
                      <td className="py-2.5 pr-4 text-amber-300/70 font-mono text-xs">{p.min || '—'}</td>
                      <td className="py-2.5 text-amber-300/70 font-mono text-xs">{p.max || '—'}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center gap-3 text-xs text-white/40 mb-4">
              <span>Batch size: <span className="text-white/60 font-semibold">{reqs.batchRows} rows</span></span>
            </div>

            {/* supplier ZK key download */}
            {!isMfg && reqs.zkeyStatus === 'ready' && (
              <div className="border border-indigo-400/20 rounded-xl p-4 bg-indigo-500/5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-white font-semibold text-sm">circuit.pk — Proving Key</p>
                    <p className="text-white/40 text-xs mt-0.5">Download and use with vc-quickprove to generate your proof.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => channelReqsService.downloadPk(channel._id).catch(() => error('Download failed'))}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-sm hover:bg-indigo-500/30 transition-all"
                  >
                    <Download size={14} /> Download circuit.pk
                  </button>
                </div>
                <div className="mt-3 text-xs text-white/40 bg-black/30 rounded-lg p-3 font-mono">
                  <p className="text-emerald-300/70">vc-quickprove --csv data.csv --order &lt;ORDER_ID&gt; --out ./out/ --pk circuit.pk</p>
                </div>
              </div>
            )}
            {!isMfg && reqs.zkeyStatus === 'generating' && (
              <div className="border border-yellow-400/20 rounded-xl p-4 bg-yellow-500/5 flex items-center gap-3 text-sm text-yellow-300">
                <RefreshCw size={14} className="animate-spin" />
                Manufacturer is generating ZK keys. Refresh in a few minutes.
              </div>
            )}
          </div>
        )}

        {/* ── Manufacturer edit section ── */}
        {isMfg && (
          <div className="mt-5">
            {!editing ? (
              <button
                type="button"
                onClick={openEdit}
                className="flex items-center gap-2 text-sm text-indigo-300 hover:text-white border border-indigo-400/30 hover:border-indigo-400/60 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-all"
              >
                <Edit3 size={14} />
                {reqs ? 'Edit Requirements & Regenerate ZK Keys' : 'Set Requirements'}
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-white/10 pt-5 mt-2"
                >
                  <form onSubmit={handleSave}>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-white font-semibold">Edit Requirements</h3>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        <ChevronUp size={14} /> Collapse
                      </button>
                    </div>

                    {/* Section 1 — supplier-visible params */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-white/80">Parameters</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/20">
                          Visible to supplier
                        </span>
                      </div>
                      <p className="text-white/40 text-xs mb-3">
                        Declare which parameters the supplier must include in their QC data CSV.
                      </p>

                      <div className="grid grid-cols-[1fr_1fr_100px_32px] gap-2 mb-2 px-1">
                        {['Parameter Name', 'Target Value', 'SI Unit', ''].map((h, i) => (
                          <span key={i} className="text-xs uppercase text-white/40 font-semibold">{h}</span>
                        ))}
                      </div>

                      <div className="space-y-2 mb-3">
                        {rows.map((row, i) => (
                          <div key={i} className="grid grid-cols-[1fr_1fr_100px_32px] gap-2 items-center">
                            <input
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 w-full"
                              placeholder="e.g. voltage"
                              value={row.name}
                              onChange={e => updateRow(i, 'name', e.target.value)}
                            />
                            <input
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 w-full"
                              placeholder="e.g. 3.7"
                              value={row.value}
                              onChange={e => updateRow(i, 'value', e.target.value)}
                            />
                            <input
                              className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 w-full"
                              placeholder="e.g. V"
                              value={row.unit}
                              onChange={e => updateRow(i, 'unit', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              disabled={rows.length === 1}
                              className="text-white/30 hover:text-red-400 disabled:opacity-20 transition-colors flex items-center justify-center"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addRow}
                        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 border border-dashed border-white/20 hover:border-white/40 rounded-lg px-4 py-2 transition-all"
                      >
                        <Plus size={14} /> Add Parameter
                      </button>
                      <p className="text-[11px] text-white/25 mt-2 pl-1">
                        Each row is a separate quality metric for <span className="text-white/40">{channel.channelName}</span>.
                      </p>
                    </div>

                    {/* Section 2 — OEM-only ranges */}
                    <div className="border border-amber-400/20 rounded-xl p-4 mb-5 bg-amber-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock size={13} className="text-amber-400" />
                        <h4 className="text-sm font-semibold text-amber-300">Acceptable Ranges</h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/20">
                          OEM only · hidden from supplier
                        </span>
                      </div>
                      <p className="text-white/40 text-xs mb-4">
                        Define min/max bounds. The ZK circuit checks that supplier data falls within these ranges.
                      </p>

                      {namedRows.length === 0 ? (
                        <p className="text-white/30 text-xs italic">Add at least one parameter above to set ranges.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 mb-2 px-1">
                            {['Parameter', 'Min', 'Max'].map(h => (
                              <span key={h} className="text-xs uppercase text-white/40 font-semibold">{h}</span>
                            ))}
                          </div>
                          <div className="space-y-2">
                            {rows.map((row, i) => {
                              if (!row.name.trim()) return null;
                              return (
                                <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                                  <div className="px-3 py-2 text-sm text-white/70 bg-white/5 rounded-lg border border-white/10 truncate">
                                    {row.name}
                                  </div>
                                  <input
                                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 w-full"
                                    placeholder="e.g. 3.5"
                                    value={row.min}
                                    onChange={e => updateRow(i, 'min', e.target.value)}
                                  />
                                  <input
                                    className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/60 w-full"
                                    placeholder="e.g. 4.2"
                                    value={row.max}
                                    onChange={e => updateRow(i, 'max', e.target.value)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                      <div className="mt-4 pt-4 border-t border-amber-400/10">
                        <label className="block text-xs uppercase text-white/40 font-semibold mb-2">
                          Batch size (CSV rows per proof)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white w-36 focus:outline-none focus:border-amber-400/60"
                          value={batchRows}
                          onChange={e => setBatchRows(parseInt(e.target.value) || 1)}
                        />
                        <p className="text-white/30 text-xs mt-1">
                          Supplier's CSV must have exactly this many rows.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 text-xs text-white/40">
                      Saving re-runs trusted setup on the server (takes a few minutes). Supplier must re-download <code className="text-white/60">circuit.pk</code> after this.
                    </div>

                    <div className="flex items-center gap-3">
                      <GlassmorphicButton type="submit" disabled={saving} loading={saving}>
                        {saving ? 'Saving…' : 'Save & Generate ZK Keys'}
                      </GlassmorphicButton>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="text-sm text-white/40 hover:text-white/70 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </GlassmorphicCard>
    </div>
  );
}

/* ─────────────── page ─────────────── */
export default function RequirementsPage() {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const toast = { error, success };

  const [user,        setUser]        = useState(null);
  const [channels,    setChannels]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [openCardId,  setOpenCardId]  = useState(null);
  const [showPicker,  setShowPicker]  = useState(false);
  const cardRefs = useRef({});

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) { navigate('/login'); return; }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    channelService.getChannels(parsedUser.id)
      .then(res => setChannels((res.data || []).filter(c => c.status === 'active')))
      .catch(err => error(err.response?.data?.error || 'Failed to load channels'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isMfg = (channel) =>
    channel?.manufacturerOrgId?._id?.toString() === user?.id?.toString();

  const handlePickChannel = (channelId) => {
    setShowPicker(false);
    setOpenCardId(channelId);
    // slight delay so the card has time to react, then scroll to it
    setTimeout(() => {
      cardRefs.current[channelId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // reset trigger so re-clicking the same channel still works
      setTimeout(() => setOpenCardId(null), 500);
    }, 80);
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="flex justify-center items-center h-96"><LoadingSpinner /></div>
      </Layout>
    );
  }

  const mfgChannels = channels.filter(ch => isMfg(ch));

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Requirements</h1>
          <p className="text-white/70">Quality parameters and ZK keys, per channel.</p>
        </div>

        {channels.length === 0 ? (
          <GlassmorphicCard className="p-10 text-center">
            <p className="text-white/80 text-lg font-semibold mb-2">No active channels</p>
            <p className="text-white/50 text-sm mb-6">Connect with a partner organization first.</p>
            <GlassmorphicButton onClick={() => navigate('/dashboard')}>Find Partners</GlassmorphicButton>
          </GlassmorphicCard>
        ) : (
          <>
            <div className="space-y-5">
              {channels.map(ch => (
                <ChannelReqCard
                  key={ch._id}
                  channel={ch}
                  isMfg={isMfg(ch)}
                  onToast={toast}
                  autoOpen={openCardId === ch._id}
                  cardRef={el => { cardRefs.current[ch._id] = el; }}
                />
              ))}
            </div>

            {/* ── Bottom action panel ── */}
            {mfgChannels.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-white/40 font-medium">Jump to a channel to set or update its requirements:</p>
                </div>

                <div className="flex flex-wrap gap-3 mb-5">
                  {mfgChannels.map(ch => (
                    <button
                      key={ch._id}
                      type="button"
                      onClick={() => handlePickChannel(ch._id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-400/25 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-400/50 text-indigo-300 text-sm transition-all"
                    >
                      <Network size={13} />
                      {ch.channelName}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 text-sm text-white/30 hover:text-white/60 border border-dashed border-white/15 hover:border-white/30 px-4 py-2.5 rounded-xl transition-all"
                >
                  <ListPlus size={15} />
                  Connect with another partner to add more channels
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
}
