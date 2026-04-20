// src/pages/Inventory.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageHeader, Tabs, Modal, Spinner, Empty } from '../components/ui';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Inventory() {
  const [tab, setTab] = useState('frames');
  const [data, setData] = useState({ frames: [], lenses: [], accessories: [] });
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState([]);
  const [adjModal, setAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ frameId: '', lensId: '', accessoryId: '', type: 'IN', quantity: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    api.get('/inventory').then(r => setData(r.data.data)),
    api.get('/inventory/movements').then(r => setMovements(r.data.data))
  ]).catch(() => toast.error('Failed')).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const saveAdj = async () => {
    if (!adjForm.quantity) return toast.error('Quantity required');
    if (!adjForm.frameId && !adjForm.lensId && !adjForm.accessoryId) return toast.error('Select an item');
    setSaving(true);
    try {
      await api.post('/inventory/adjust', adjForm);
      toast.success('Stock adjusted');
      setAdjModal(false);
      load();
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const allFrames = data.frames || [];
  const allLenses = data.lenses || [];

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock levels and movements"
        action={<button className="btn-primary btn-md" onClick={() => setAdjModal(true)}>Adjust Stock</button>} />

      <Tabs tabs={[{ id: 'frames', label: `Frames (${allFrames.length})` }, { id: 'lenses', label: `Lenses (${allLenses.length})` }, { id: 'movements', label: 'Movements' }]} active={tab} onChange={setTab} />

      <div className="mt-4">
        {loading ? <div className="flex justify-center py-16"><Spinner size={28} /></div> :
          tab === 'frames' ? (
            <div className="card overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Code</th><th>Brand / Model</th><th>Color</th><th>Cost</th><th>Price</th><th>Stock</th><th>Alert</th><th>Status</th></tr></thead>
                <tbody>
                  {allFrames.map(f => (
                    <tr key={f.id}>
                      <td className="font-mono text-xs text-slate-400">{f.frameCode}</td>
                      <td><div className="font-semibold text-slate-800 text-sm">{f.brand}</div><div className="text-xs text-slate-400">{f.model}</div></td>
                      <td className="text-xs text-slate-500">{f.color || '—'}</td>
                      <td className="text-xs text-slate-400">{fmt(f.purchasePrice)}</td>
                      <td className="font-semibold text-sm">{fmt(f.sellingPrice)}</td>
                      <td className="font-bold text-center">{f.stockQty}</td>
                      <td className="text-center text-xs text-slate-400">{f.lowStockAlert}</td>
                      <td>
                        {f.stockQty === 0 ? <span className="badge-red badge">Out of Stock</span>
                          : f.stockQty <= f.lowStockAlert ? <span className="badge-yellow badge">Low Stock</span>
                          : <span className="badge-green badge">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === 'lenses' ? (
            <div className="card overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Name</th><th>Type</th><th>Index</th><th>Brand</th><th>Price</th><th>Stock</th></tr></thead>
                <tbody>
                  {allLenses.map(l => (
                    <tr key={l.id}>
                      <td className="font-semibold text-slate-800 text-sm">{l.name}</td>
                      <td><span className="badge-blue badge text-xs">{l.lensType.replace('_', ' ')}</span></td>
                      <td className="text-xs text-slate-500">{l.lensIndex}</td>
                      <td className="text-xs text-slate-500">{l.brand || '—'}</td>
                      <td className="font-semibold">{fmt(l.sellingPrice)}</td>
                      <td>
                        <span className={`badge ${l.stockQty <= l.lowStockAlert ? 'badge-yellow' : 'badge-green'}`}>{l.stockQty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Before</th><th>After</th><th>Reason</th></tr></thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="text-sm font-semibold text-slate-700">{m.frame?.brand ? `${m.frame.brand} ${m.frame.model || ''}` : m.lens?.name || '—'}</td>
                      <td>
                        <span className={`badge ${m.type === 'IN' || m.type === 'RETURN' ? 'badge-green' : m.type === 'OUT' ? 'badge-red' : 'badge-yellow'}`}>{m.type}</span>
                      </td>
                      <td className="font-bold">{m.quantity}</td>
                      <td className="text-slate-400">{m.beforeQty}</td>
                      <td className="font-semibold">{m.afterQty}</td>
                      <td className="text-xs text-slate-400">{m.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Modal open={adjModal} onClose={() => setAdjModal(false)} title="Adjust Stock"
        footer={<><button className="btn-secondary btn-md" onClick={() => setAdjModal(false)}>Cancel</button><button className="btn-primary btn-md" onClick={saveAdj} disabled={saving}>{saving ? 'Saving…' : 'Adjust'}</button></>}>
        <div className="space-y-4">
          <div>
            <label className="field-label">Item Type</label>
            <select className="field-select" value={adjForm.frameId ? 'frame' : adjForm.lensId ? 'lens' : 'frame'}
              onChange={e => setAdjForm(f => ({ ...f, frameId: '', lensId: '', accessoryId: '' }))}>
              <option value="frame">Frame</option><option value="lens">Lens</option>
            </select>
          </div>
          <div>
            <label className="field-label">Select Frame</label>
            <select className="field-select" value={adjForm.frameId} onChange={e => setAdjForm(f => ({ ...f, frameId: e.target.value, lensId: '' }))}>
              <option value="">— Select —</option>
              {allFrames.map(f => <option key={f.id} value={f.id}>{f.brand} {f.model} ({f.stockQty})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Type</label>
              <select className="field-select" value={adjForm.type} onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))}>
                <option value="IN">IN (+)</option>
                <option value="OUT">OUT (-)</option>
                <option value="ADJUSTMENT">SET (=)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Quantity</label>
              <input className="field-input" type="number" value={adjForm.quantity} onChange={e => setAdjForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="field-label">Reason</label>
            <input className="field-input" value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))} placeholder="Damage, correction, etc." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
