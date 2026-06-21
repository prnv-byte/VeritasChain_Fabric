import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

// Read a File object and return its text content
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function emptyGlobalRow() { return { name: '', value: '', unit: '' }; }
function emptyZkRow()     { return { name: '', min: '', max: '', unit: '' }; }

export default function RequirementsPanel({ channel, myOrg, showToast }) {
  const manufacturerMSP = channel.manufacturerOrgId?.mspId;
  const isManufacturer  = myOrg.mspId === manufacturerMSP;

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [existing,      setExisting]      = useState(null);   // loaded from chain

  // Form state (manufacturer only)
  const [componentType, setComponentType] = useState('');
  const [globalRows,    setGlobalRows]    = useState([emptyGlobalRow()]);
  const [zkRows,        setZkRows]        = useState([emptyZkRow()]);
  const [vkFile,        setVkFile]        = useState(null);
  const [vkFileName,    setVkFileName]    = useState('');

  const loadRequirements = useCallback(async () => {
    if (!manufacturerMSP) return;
    setLoading(true);
    try {
      const data = await api.getRequirements(channel.channelName, myOrg.mspId, manufacturerMSP);
      if (data && !data.error) {
        setExisting(data);
        setComponentType(data.componentType || '');
        try { setGlobalRows(JSON.parse(data.globalRequirements) || [emptyGlobalRow()]); } catch { setGlobalRows([emptyGlobalRow()]); }
        try { setZkRows(JSON.parse(data.zkRanges) || [emptyZkRow()]); }               catch { setZkRows([emptyZkRow()]); }
      } else {
        setExisting(null);
      }
    } catch (_) {
      setExisting(null);
    } finally {
      setLoading(false);
    }
  }, [channel.channelName, manufacturerMSP, myOrg.mspId]);

  useEffect(() => { loadRequirements(); }, [loadRequirements]);

  async function handleSave(e) {
    e.preventDefault();

    // Validate rows — every row must have at least a name
    const validGlobal = globalRows.filter(r => r.name.trim());
    const validZk     = zkRows.filter(r => r.name.trim());
    if (validGlobal.length === 0) { showToast('Add at least one global requirement', 'error'); return; }
    if (validZk.length === 0)     { showToast('Add at least one ZK range parameter', 'error'); return; }

    // Verification key: required on first save, optional on update (keeps existing if not re-uploaded)
    let verificationKey = existing?.verificationKey || '';
    if (vkFile) {
      try {
        verificationKey = await readFileAsText(vkFile);
        JSON.parse(verificationKey); // validate it's JSON
      } catch {
        showToast('verification_key.json is not valid JSON', 'error');
        return;
      }
    }
    if (!verificationKey) {
      showToast('Please upload verification_key.json', 'error');
      return;
    }

    setSaving(true);
    try {
      const r = await api.setRequirements({
        channel:            channel.channelName,
        mspId:              myOrg.mspId,
        componentType:      componentType || 'general',
        globalRequirements: JSON.stringify(validGlobal),
        zkRanges:           JSON.stringify(validZk),
        verificationKey,
      });
      if (r.error) {
        showToast(r.error, 'error');
      } else {
        showToast('Requirements saved to chain', 'success');
        await loadRequirements();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Row helpers ──────────────────────────────────────────────────────────────

  function updateGlobalRow(i, field, value) {
    setGlobalRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function addGlobalRow()    { setGlobalRows(r => [...r, emptyGlobalRow()]); }
  function removeGlobalRow(i){ setGlobalRows(r => r.filter((_, idx) => idx !== i)); }

  function updateZkRow(i, field, value) {
    setZkRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function addZkRow()    { setZkRows(r => [...r, emptyZkRow()]); }
  function removeZkRow(i){ setZkRows(r => r.filter((_, idx) => idx !== i)); }

  // ── Render ───────────────────────────────────────────────────────────────────

  const partnerName = isManufacturer
    ? (channel.supplierOrgId?.name || channel.channelName)
    : (channel.manufacturerOrgId?.name || channel.channelName);

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
        <span className="spinner" /> Loading requirements...
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Requirements — {channel.channelName}
        </h2>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          {isManufacturer
            ? `Shared with supplier: ${partnerName}`
            : `Set by manufacturer: ${partnerName}`}
        </p>
        {existing && (
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
            Last updated: {new Date(existing.setAt).toLocaleString()}
          </p>
        )}
        {!existing && !isManufacturer && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 'var(--radius)',
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
            color: '#fbbf24', fontSize: 13,
          }}>
            Manufacturer has not set requirements yet. Check back later.
          </div>
        )}
      </div>

      {/* Supplier read-only view */}
      {!isManufacturer && existing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Section title="Component Type">
            <span style={{ fontSize: 14, fontWeight: 600 }}>{existing.componentType || '—'}</span>
          </Section>

          <Section title="Global Requirements" subtitle="Target values for production">
            <ParamTable
              columns={['Parameter', 'Target Value', 'Unit']}
              rows={safeParseRows(existing.globalRequirements)}
              renderRow={(row) => [row.name, row.value, row.unit]}
            />
          </Section>

          <Section title="ZK Range Parameters" subtitle="Acceptable range used in proof verification">
            <ParamTable
              columns={['Parameter', 'Min', 'Max', 'Unit']}
              rows={safeParseRows(existing.zkRanges)}
              renderRow={(row) => [row.name, row.min, row.max, row.unit]}
            />
          </Section>
        </div>
      )}

      {/* Manufacturer editable form */}
      {isManufacturer && (
        <form onSubmit={handleSave}>
          {/* Component Type */}
          <Section title="Component Type">
            <input
              className="form-input"
              type="text"
              placeholder="e.g. battery, motor, chassis"
              value={componentType}
              onChange={e => setComponentType(e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </Section>

          {/* Global Requirements */}
          <Section
            title="Global Requirements"
            subtitle="Target specs you need — visible to supplier for production guidance"
          >
            <EditableTable
              columns={['Parameter Name', 'Target Value', 'Unit', '']}
              rows={globalRows}
              onAdd={addGlobalRow}
              renderRow={(row, i) => (
                <>
                  <td><input className="form-input" placeholder="e.g. Voltage"  value={row.name}  onChange={e => updateGlobalRow(i, 'name', e.target.value)} /></td>
                  <td><input className="form-input" placeholder="e.g. 25"        value={row.value} onChange={e => updateGlobalRow(i, 'value', e.target.value)} /></td>
                  <td><input className="form-input" placeholder="e.g. V"         value={row.unit}  onChange={e => updateGlobalRow(i, 'unit', e.target.value)} /></td>
                  <td>
                    {globalRows.length > 1 && (
                      <button type="button" onClick={() => removeGlobalRow(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                        ×
                      </button>
                    )}
                  </td>
                </>
              )}
            />
          </Section>

          {/* ZK Ranges */}
          <Section
            title="ZK Range Parameters"
            subtitle="Acceptable range for proof verification — supplier generates proof against these bounds"
          >
            <EditableTable
              columns={['Parameter Name', 'Min', 'Max', 'Unit', '']}
              rows={zkRows}
              onAdd={addZkRow}
              renderRow={(row, i) => (
                <>
                  <td><input className="form-input" placeholder="e.g. Voltage"  value={row.name} onChange={e => updateZkRow(i, 'name', e.target.value)} /></td>
                  <td><input className="form-input" placeholder="e.g. 23"        value={row.min}  onChange={e => updateZkRow(i, 'min', e.target.value)} /></td>
                  <td><input className="form-input" placeholder="e.g. 27"        value={row.max}  onChange={e => updateZkRow(i, 'max', e.target.value)} /></td>
                  <td><input className="form-input" placeholder="e.g. V"         value={row.unit} onChange={e => updateZkRow(i, 'unit', e.target.value)} /></td>
                  <td>
                    {zkRows.length > 1 && (
                      <button type="button" onClick={() => removeZkRow(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                        ×
                      </button>
                    )}
                  </td>
                </>
              )}
            />
          </Section>

          {/* Verification Key Upload */}
          <Section
            title="Verification Key"
            subtitle="verification_key.json from Pranav's trusted setup — used by manufacturer to verify proofs"
          >
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderRadius: 'var(--radius)',
              border: '1px dashed var(--border)', cursor: 'pointer',
              background: vkFileName ? 'rgba(34,197,94,0.06)' : 'var(--surface2)',
            }}>
              <span style={{ fontSize: 18 }}>{vkFileName ? '✓' : '↑'}</span>
              <span style={{ fontSize: 13, color: vkFileName ? '#22c55e' : 'var(--text-muted)' }}>
                {vkFileName || (existing?.verificationKey ? 'Re-upload to replace current key' : 'Upload verification_key.json')}
              </span>
              <input type="file" accept=".json,application/json" style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files[0] || null;
                  setVkFile(f);
                  setVkFileName(f ? f.name : '');
                }}
              />
            </label>
            {existing?.verificationKey && !vkFileName && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Key already on chain — leave blank to keep existing key.
              </p>
            )}
          </Section>

          <div style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving to Chain...</> : 'Save Requirements'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function EditableTable({ columns, rows, onAdd, renderRow }) {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{
                textAlign: 'left', fontSize: 11, fontWeight: 600,
                color: 'var(--text-muted)', padding: '4px 8px 8px 0',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ verticalAlign: 'middle' }}>
              {renderRow(row, i)}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 8, background: 'none', border: '1px dashed var(--border)',
          borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 12,
        }}
      >
        + Add Row
      </button>
    </div>
  );
}

function ParamTable({ columns, rows, renderRow }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No parameters set.</p>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{
              textAlign: 'left', fontSize: 11, fontWeight: 600,
              color: 'var(--text-muted)', padding: '4px 12px 8px 0',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              borderBottom: '1px solid var(--border)',
            }}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {renderRow(row).map((cell, j) => (
              <td key={j} style={{
                padding: '8px 12px 8px 0', fontSize: 13,
                borderBottom: '1px solid var(--border)',
                color: j === 0 ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: j === 0 ? 500 : 400,
              }}>
                {cell || '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function safeParseRows(str) {
  try { return JSON.parse(str) || []; } catch { return []; }
}
