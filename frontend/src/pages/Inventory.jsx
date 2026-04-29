import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PageHeader, Tabs, Modal, Spinner, Empty } from '../components/ui';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { isAdmin } from '../utils/roles';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function StockStatus({ qty, alert }) {
  if (qty === 0) return <span className="badge-red badge">Out of Stock</span>;
  if (qty <= alert) return <span className="badge-yellow badge">Low Stock</span>;
  return <span className="badge-green badge">OK</span>;
}

export default function Inventory() {
  const [tab, setTab] = useState('frames');
  const [data, setData] = useState({ frames: [], lenses: [], accessories: [] });
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState([]);
  const [adjModal, setAdjModal] = useState(false);
  const [itemType, setItemType] = useState('frame'); // for adj modal
  const [adjForm, setAdjForm] = useState({ frameId: '', lensId: '', accessoryId: '', type: 'IN', quantity: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canManageInventory = isAdmin(user);

  const load = () => Promise.all([
    api.get('/inventory').then(r => setData(r.data.data)),
    api.get('/inventory/movements').then(r => setMovements(r.data.data))
  ]).catch(() => toast.error('Failed to load inventory')).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const saveAdj = async () => {
    if (!adjForm.quantity || isNaN(Number(adjForm.quantity))) return toast.error('Valid quantity required');
    if (!adjForm.frameId && !adjForm.lensId && !adjForm.accessoryId) return toast.error('Select an item');
    setSaving(true);
    try {
      await api.post('/inventory/adjust', adjForm);
      toast.success('Stock adjusted');
      setAdjModal(false);
      setAdjForm({ frameId: '', lensId: '', accessoryId: '', type: 'IN', quantity: '', reason: '' });
      load();
    } catch { toast.error('Error adjusting stock'); }
    setSaving(false);
  };

  const allFrames = data.frames || [];
  const allLenses = data.lenses || [];
  const allAccessories = data.accessories || [];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock levels and movements"
        action={canManageInventory && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary btn-md" onClick={() => setAdjModal(true)}>
              Adjust Stock
            </button>
            {/* FIX: correct route path */}
            <button className="btn-secondary btn-md" onClick={() => navigate('/bulk-import')}>
              Bulk Import
            </button>
          </div>
        )}
      />

      <Tabs
        tabs={[
          { id: 'frames', label: `Frames (${allFrames.length})` },
          { id: 'lenses', label: `Lenses (${allLenses.length})` },
          { id: 'accessories', label: `Accessories (${allAccessories.length})` },
          { id: 'movements', label: 'Movements' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : tab === 'frames' ? (
          allFrames.length === 0 ? (
            <div className="card"><Empty icon="🕶️" title="No frames in inventory" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Brand / Model</th>
                      <th className="hidden sm:table-cell">Color</th>
                      <th className="hidden lg:table-cell">Cost</th>
                      <th>Price</th>
                      <th className="text-center">Stock</th>
                      <th className="hidden md:table-cell text-center">Alert</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allFrames.map(f => (
                      <tr key={f.id}>
                        <td>
                          <div className="font-semibold text-slate-800 text-sm">{f.brand}</div>
                          <div className="text-xs text-slate-400">{f.model || f.frameCode}</div>
                        </td>
                        <td className="hidden sm:table-cell text-xs text-slate-500">{f.color || '—'}</td>
                        <td className="hidden lg:table-cell text-xs text-slate-400">{fmt(f.purchasePrice)}</td>
                        <td className="font-semibold text-sm">{fmt(f.sellingPrice)}</td>
                        <td className="font-bold text-center">{f.stockQty}</td>
                        <td className="hidden md:table-cell text-center text-xs text-slate-400">{f.lowStockAlert}</td>
                        <td><StockStatus qty={f.stockQty} alert={f.lowStockAlert} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : tab === 'lenses' ? (
          allLenses.length === 0 ? (
            <div className="card"><Empty icon="🔬" title="No lenses in inventory" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[400px]">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="hidden sm:table-cell">Type</th>
                      <th className="hidden md:table-cell">Index</th>
                      <th className="hidden lg:table-cell">Brand</th>
                      <th>Price</th>
                      <th className="text-center">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLenses.map(l => (
                      <tr key={l.id}>
                        <td>
                          <div className="font-semibold text-slate-800 text-sm">{l.name}</div>
                          <div className="text-xs text-slate-400 sm:hidden">{l.lensType?.replace('_', ' ')}</div>
                        </td>
                        <td className="hidden sm:table-cell">
                          <span className="badge-blue badge text-xs">{l.lensType?.replace('_', ' ')}</span>
                        </td>
                        <td className="hidden md:table-cell text-xs text-slate-500">{l.lensIndex}</td>
                        <td className="hidden lg:table-cell text-xs text-slate-500">{l.brand || '—'}</td>
                        <td className="font-semibold text-sm">{fmt(l.sellingPrice)}</td>
                        <td className="text-center">
                          <span className={`badge ${l.stockQty <= (l.lowStockAlert || 5) ? 'badge-yellow' : 'badge-green'}`}>{l.stockQty}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : tab === 'accessories' ? (
          allAccessories.length === 0 ? (
            <div className="card"><Empty icon="🧴" title="No accessories in inventory" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[400px]">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="hidden sm:table-cell">Brand</th>
                      <th>Price</th>
                      <th className="text-center">Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAccessories.map(a => (
                      <tr key={a.id}>
                        <td className="font-semibold text-slate-800 text-sm">{a.name}</td>
                        <td className="hidden sm:table-cell text-xs text-slate-500">{a.brand || '—'}</td>
                        <td className="font-semibold text-sm">{fmt(a.sellingPrice)}</td>
                        <td className="font-bold text-center">{a.stockQty}</td>
                        <td><StockStatus qty={a.stockQty} alert={a.lowStockAlert || 5} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* Movements */
          movements.length === 0 ? (
            <div className="card"><Empty icon="📦" title="No stock movements yet" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tbl min-w-[500px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th className="text-center">Qty</th>
                      <th className="hidden sm:table-cell text-center">Before</th>
                      <th className="hidden sm:table-cell text-center">After</th>
                      <th className="hidden md:table-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id}>
                        <td className="text-xs text-slate-400 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="text-sm font-semibold text-slate-700">
                          {m.frame?.brand ? `${m.frame.brand} ${m.frame.model || ''}`.trim()
                            : m.lens?.name || m.accessory?.name || '—'}
                        </td>
                        <td>
                          <span className={`badge text-xs ${
                            m.type === 'IN' || m.type === 'RETURN' ? 'badge-green'
                            : m.type === 'OUT' ? 'badge-red'
                            : 'badge-yellow'
                          }`}>{m.type}</span>
                        </td>
                        <td className="font-bold text-center">{m.quantity}</td>
                        <td className="hidden sm:table-cell text-center text-slate-400 text-sm">{m.beforeQty}</td>
                        <td className="hidden sm:table-cell text-center font-semibold text-sm">{m.afterQty}</td>
                        <td className="hidden md:table-cell text-xs text-slate-400">{m.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Adjust Stock Modal ── */}
      <Modal
        open={adjModal}
        onClose={() => setAdjModal(false)}
        title="Adjust Stock"
        footer={
          <>
            <button className="btn-secondary btn-md" onClick={() => setAdjModal(false)}>Cancel</button>
            <button className="btn-primary btn-md" onClick={saveAdj} disabled={saving}>
              {saving ? 'Saving…' : 'Adjust'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Item type */}
          <div>
            <label className="field-label">Item Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['frame', 'lens', 'accessory'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setItemType(t);
                    setAdjForm(f => ({ ...f, frameId: '', lensId: '', accessoryId: '' }));
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all capitalize ${itemType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Item selector */}
          <div>
            <label className="field-label">Select {itemType}</label>
            {itemType === 'frame' && (
              <select className="field-select" value={adjForm.frameId}
                onChange={e => setAdjForm(f => ({ ...f, frameId: e.target.value, lensId: '', accessoryId: '' }))}>
                <option value="">— Select Frame —</option>
                {allFrames.map(f => <option key={f.id} value={f.id}>{f.brand} {f.model} (Stock: {f.stockQty})</option>)}
              </select>
            )}
            {itemType === 'lens' && (
              <select className="field-select" value={adjForm.lensId}
                onChange={e => setAdjForm(f => ({ ...f, lensId: e.target.value, frameId: '', accessoryId: '' }))}>
                <option value="">— Select Lens —</option>
                {allLenses.map(l => <option key={l.id} value={l.id}>{l.name} (Stock: {l.stockQty})</option>)}
              </select>
            )}
            {itemType === 'accessory' && (
              <select className="field-select" value={adjForm.accessoryId}
                onChange={e => setAdjForm(f => ({ ...f, accessoryId: e.target.value, frameId: '', lensId: '' }))}>
                <option value="">— Select Accessory —</option>
                {allAccessories.map(a => <option key={a.id} value={a.id}>{a.name} (Stock: {a.stockQty})</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Adjustment Type</label>
              <select className="field-select" value={adjForm.type}
                onChange={e => setAdjForm(f => ({ ...f, type: e.target.value }))}>
                <option value="IN">IN — Add stock (+)</option>
                <option value="OUT">OUT — Remove stock (−)</option>
                <option value="ADJUSTMENT">SET — Set exact quantity</option>
              </select>
            </div>
            <div>
              <label className="field-label">Quantity</label>
              <input
                className="field-input"
                type="number"
                min="0"
                value={adjForm.quantity}
                onChange={e => setAdjForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              className="field-input"
              value={adjForm.reason}
              onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Damage, correction, restock…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
