import { useEffect, useState, useRef } from 'react';
import { Plus, Grid, List } from 'lucide-react';
import api from '../services/api';
import { Modal, PageHeader, SearchInput, Spinner, Empty } from '../components/ui';
import toast from 'react-hot-toast';
import Label from '../components/Label';
import { Html5Qrcode } from 'html5-qrcode';

const SHAPES = ['ROUND', 'OVAL', 'RECTANGLE', 'SQUARE', 'CAT_EYE', 'AVIATOR', 'WAYFARER', 'GEOMETRIC', 'RIMLESS', 'SEMI_RIMLESS'];
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function StockBadge({ qty, alert }) {
  if (qty === 0) return <span className="badge-red badge">Out of Stock</span>;
  if (qty <= alert) return <span className="badge-yellow badge">Low · {qty}</span>;
  return <span className="badge-green badge">{qty} in stock</span>;
}

const EMPTY_FORM = {
  brand: '', model: '', shape: 'RECTANGLE', size: '', color: '',
  material: '', gender: '', purchasePrice: '', sellingPrice: '',
  stockQty: '', lowStockAlert: '5', barcode: '', modelCode: ''
};

export default function Frames() {
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState({ brand: '', shape: '' });
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editFrame, setEditFrame] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const scannerReadyRef = useRef(false);

  // ── Barcode generation ──────────────────────────────────────────────────────
  const generateEAN13 = () => {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (checksum % 10)) % 10;
    return [...digits, checkDigit].join('');
  };

  const handleGenerateBarcode = () => {
    setForm(f => ({ ...f, barcode: generateEAN13() }));
    toast.success('Barcode generated!');
  };

  // ── Scanner ─────────────────────────────────────────────────────────────────
  const stopScanner = async () => {
    scannerReadyRef.current = false;
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      try { await scannerRef.current.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    if (scannerRef.current || scannerReadyRef.current) return;

    // Ensure the div exists in DOM before initialising
    await new Promise(r => setTimeout(r, 50));

    const scanner = new Html5Qrcode('reader-frames');
    scannerRef.current = scanner;

    const onSuccess = async (decodedText) => {
      setForm(f => ({ ...f, barcode: decodedText }));
      toast.success('Barcode scanned!');
      await stopScanner();
    };

    const tryStart = async (constraints) => {
      try {
        await scanner.start(constraints, { fps: 10, qrbox: { width: 250, height: 150 } }, onSuccess, () => { });
        scannerReadyRef.current = true;
        setScanning(true);
      } catch {
        if (constraints.facingMode === 'environment') {
          await tryStart({ facingMode: 'user' });
        } else if (constraints.facingMode === 'user') {
          await tryStart({});
        } else {
          scannerRef.current = null;
          toast.error('Could not access camera. Please allow camera permission.');
        }
      }
    };

    await tryStart({ facingMode: 'environment' });
  };

  const toggleScanner = () => {
    if (scanning) { stopScanner(); } else { startScanner(); }
  };

  // Stop scanner when modal closes
  const handleModalClose = () => {
    if (scanning) stopScanner();
    setModal(false);
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const load = async (q = '', f = {}) => {
    setLoading(true);
    try {
      const r = await api.get('/frames', { params: { search: q, ...f, limit: 60 } });
      setFrames(r.data.data);
      if (r.data.filters?.brands?.length) setBrands(r.data.filters.brands);
    } catch { toast.error('Failed to load frames'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(search, filters), 350);
    return () => clearTimeout(t);
  }, [search, filters]);

  const openAdd = () => {
    setEditFrame(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = f => {
    setEditFrame(f);
    setForm({
      brand: f.brand, model: f.model || '', shape: f.shape,
      size: f.size || '', color: f.color || '', material: f.material || '',
      gender: f.gender || '', purchasePrice: f.purchasePrice,
      sellingPrice: f.sellingPrice, stockQty: f.stockQty,
      lowStockAlert: f.lowStockAlert, barcode: f.barcode || '',
      modelCode: f.modelCode || ''
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.brand || !form.sellingPrice) return toast.error('Brand and selling price required');
    setSaving(true);
    try {
      if (editFrame) {
        await api.put(`/frames/${editFrame.id}`, form);
        toast.success('Frame updated');
      } else {
        await api.post('/frames', form);
        toast.success('Frame added');
      }
      setModal(false);
      load(search, filters);
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving frame'); }
    setSaving(false);
  };

  const del = async id => {
    if (!confirm('Delete this frame?')) return;
    try { await api.delete(`/frames/${id}`); toast.success('Deleted'); load(search, filters); }
    catch { toast.error('Error deleting frame'); }
  };

  const f = form; // shorthand for JSX below
  const margin = f.purchasePrice && f.sellingPrice
    ? Math.round((f.sellingPrice - f.purchasePrice) / f.sellingPrice * 100)
    : null;

  return (
    <div>
      <PageHeader
        title="Frames"
        subtitle={`${frames.length} items`}
        action={<button className="btn-primary btn-md" onClick={openAdd}><Plus size={15} /> Add Frame</button>}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap items-stretch sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search brand, model, barcode…" className="sm:flex-1 sm:min-w-48 sm:max-w-72" />
        <select className="field-select w-full sm:w-40" value={filters.brand} onChange={e => setFilters(f => ({ ...f, brand: e.target.value }))}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="field-select w-full sm:w-44" value={filters.shape} onChange={e => setFilters(f => ({ ...f, shape: e.target.value }))}>
          <option value="">All Shapes</option>
          {SHAPES.map(s => <option key={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Grid size={15} /></button>
          <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><List size={15} /></button>
        </div>
      </div>

      {/* Frame list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : frames.length === 0 ? (
        <div className="card"><Empty icon="🕶️" title="No frames found" /></div>
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {frames.map(fr => (
            <div key={fr.id} className="card card-hover overflow-hidden group">
              <div className="h-36 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative">
                <span className="text-6xl opacity-60">🕶️</span>
                <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(fr)} className="btn-secondary btn-xs shadow-sm">Edit</button>
                  <button onClick={() => del(fr.id)} className="btn-danger btn-xs shadow-sm">Del</button>
                </div>
                {fr.stockQty === 0 && (
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                    <span className="text-white font-bold text-sm bg-red-500 rounded-lg px-2.5 py-1">Out of Stock</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{fr.brand}</div>
                    <div className="text-xs text-slate-500">{fr.model || fr.frameCode}</div>
                  </div>
                  <span className="badge-gray badge text-xs flex-shrink-0">{fr.shape?.replace('_', ' ')}</span>
                </div>
                {fr.color && <div className="text-xs text-slate-500 mb-2">🎨 {fr.color}{fr.size ? ` · ${fr.size}` : ''}</div>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-slate-900">{fmt(fr.sellingPrice)}</span>
                  <StockBadge qty={fr.stockQty} alert={fr.lowStockAlert} />
                </div>
                <div className="mt-3">
                  <button onClick={() => setSelectedFrame(fr)} className="btn-secondary btn-xs w-full">Print Label</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr><th>Code</th><th>Brand / Model</th><th>Shape</th><th>Color</th><th>Cost</th><th>Price</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              {frames.map(fr => (
                <tr key={fr.id}>
                  <td className="font-mono text-xs text-slate-400">{fr.frameCode}</td>
                  <td><div className="font-semibold text-slate-800">{fr.brand}</div><div className="text-xs text-slate-400">{fr.model}</div></td>
                  <td className="text-xs">{fr.shape?.replace('_', ' ')}</td>
                  <td className="text-xs">{fr.color}</td>
                  <td className="text-slate-500 text-xs">{fmt(fr.purchasePrice)}</td>
                  <td className="font-semibold">{fmt(fr.sellingPrice)}</td>
                  <td><StockBadge qty={fr.stockQty} alert={fr.lowStockAlert} /></td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(fr)} className="btn-ghost btn-xs">Edit</button>
                      <button onClick={() => del(fr.id)} className="btn-danger btn-xs">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={handleModalClose}
        title={editFrame ? 'Edit Frame' : 'Add Frame'}
        size="lg"
        footer={
          <>
            <button className="btn-secondary btn-md" onClick={handleModalClose}>Cancel</button>
            <button className="btn-primary btn-md" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editFrame ? 'Update' : 'Add Frame'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="field-label">Brand *</label><input className="field-input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Titan, Ray-Ban…" /></div>
          <div><label className="field-label">Model</label><input className="field-input" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Octane" /></div>
          <div><label className="field-label">Model Code</label><input className="field-input" value={form.modelCode} onChange={e => setForm(f => ({ ...f, modelCode: e.target.value }))} placeholder="VO5645I" /></div>
          <div><label className="field-label">Shape</label><select className="field-select" value={form.shape} onChange={e => setForm(f => ({ ...f, shape: e.target.value }))}>{SHAPES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
          <div><label className="field-label">Size</label><input className="field-input" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="Small / Medium / Large" /></div>
          <div><label className="field-label">Color</label><input className="field-input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Black, Gold…" /></div>
          <div><label className="field-label">Material</label><input className="field-input" value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="Metal, Acetate…" /></div>
          <div><label className="field-label">Gender</label><select className="field-select" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option value="">Unisex</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
          <div><label className="field-label">Purchase Price ₹</label><input className="field-input" type="number" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} placeholder="800" /></div>
          <div><label className="field-label">Selling Price ₹ *</label><input className="field-input" type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="1999" /></div>
          <div><label className="field-label">Stock Qty</label><input className="field-input" type="number" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} placeholder="10" /></div>
          <div><label className="field-label">Low Stock Alert</label><input className="field-input" type="number" value={form.lowStockAlert} onChange={e => setForm(f => ({ ...f, lowStockAlert: e.target.value }))} placeholder="5" /></div>

          {/* Margin indicator */}
          {margin !== null && (
            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm">
              <span className="text-emerald-700 font-semibold">Margin: {margin}%</span>
              <span className="text-emerald-600 ml-3">Profit: {fmt(form.sellingPrice - form.purchasePrice)} per unit</span>
            </div>
          )}

          {/* Barcode field */}
          <div className="sm:col-span-2">
            <label className="field-label">Barcode</label>
            <div className="flex gap-2 mb-2">
              <input
                className="field-input flex-1 font-mono"
                value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="Scan or enter barcode number"
              />
              <button type="button" onClick={handleGenerateBarcode} className="btn-secondary btn-sm whitespace-nowrap" title="Auto-generate EAN-13 barcode">
                🔄 Generate
              </button>
              <button type="button" onClick={toggleScanner} className={`btn-sm whitespace-nowrap ${scanning ? 'btn-danger' : 'btn-secondary'}`} title={scanning ? 'Stop camera' : 'Scan with camera'}>
                {scanning ? '⏹ Stop' : '📷 Scan'}
              </button>
            </div>

            {/* Camera feed — always in DOM, height toggled */}
            <div
              id="reader-frames"
              style={{
                width: '100%',
                height: scanning ? '260px' : '0px',
                overflow: 'hidden',
                borderRadius: '8px',
                border: scanning ? '2px solid #3b82f6' : 'none',
                transition: 'height 0.2s ease',
                background: '#000',
              }}
            />
            {scanning && (
              <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Align barcode inside the frame — it will scan automatically.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Print label modal */}
      {selectedFrame && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg max-w-[95vw]">
            <Label product={selectedFrame} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary btn-sm" onClick={() => setSelectedFrame(null)}>Close</button>
              <button className="btn-primary btn-sm" onClick={() => {
                const el = document.getElementById('print-label-frame');
                if (el) { el.style.display = 'block'; window.print(); el.style.display = 'none'; }
              }}>Print</button>
            </div>
          </div>
        </div>
      )}
      {selectedFrame && (
        <div id="print-label-frame" style={{ display: 'none' }}>
          <Label product={selectedFrame} />
        </div>
      )}
    </div>
  );
}