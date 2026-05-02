import { useEffect, useState, useRef } from 'react';
import { Plus, Grid, List, Package, Filter } from 'lucide-react';
import api from '../services/api';
import { Modal, PageHeader, SearchInput, StatusBadge, Spinner, Empty, Badge } from '../components/ui';
import toast from 'react-hot-toast';
import Label, { PrintLabelButton } from '../components/Label';
import { Html5Qrcode } from "html5-qrcode";
import { useAuthStore } from '../stores/authStore';
import { isAdmin } from '../utils/roles';

const SHAPES = ['ROUND', 'OVAL', 'RECTANGLE', 'SQUARE', 'CAT_EYE', 'AVIATOR', 'WAYFARER', 'GEOMETRIC', 'RIMLESS', 'SEMI_RIMLESS'];
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function StockBadge({ qty, alert }) {
  if (qty === 0) return <span className="badge-red badge">Out of Stock</span>;
  if (qty <= alert) return <span className="badge-yellow badge">Low · {qty}</span>;
  return <span className="badge-green badge">{qty} in stock</span>;
}

export default function Frames() {
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState({ brand: '', shape: '' });
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editFrame, setEditFrame] = useState(null);
  const [form, setForm] = useState({ brand: '', model: '', shape: 'RECTANGLE', size: '', color: '', material: '', gender: '', purchasePrice: '', sellingPrice: '', stockQty: '', lowStockAlert: '5', barcode: '' });
  const [saving, setSaving] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [printQty, setPrintQty] = useState(1);
  const scannerRef = useRef(null);
  const scannerReadyRef = useRef(false);
  const { user } = useAuthStore();
  const canManageFrames = isAdmin(user);

  const generateEAN13 = () => {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (checksum % 10)) % 10;
    return [...digits, checkDigit].join('');
  };

  const handleGenerateBarcode = () => {
    const code = generateEAN13();
    setForm(f => ({ ...f, barcode: code }));
    toast.success('Barcode generated!');
  };

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
      } catch (err) {
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

  const handleModalClose = () => {
    if (scanning) stopScanner();
    setModal(false);
  };

  const load = async (q = '', f = {}) => {
    setLoading(true);
    try {
      const r = await api.get('/frames', { params: { search: q, ...f, limit: 60 } });
      setFrames(r.data.data);
      if (r.data.filters?.brands?.length) setBrands(r.data.filters.brands);
    } catch (e) { toast.error('Failed to load frames'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(search, filters), 350); return () => clearTimeout(t); }, [search, filters]);
  useEffect(() => {
    return () => {
      if (scanning) stopScanner();
    };
  }, [scanning]);

  const openAdd = () => { setEditFrame(null); setForm({ brand: '', model: '', shape: 'RECTANGLE', size: '', color: '', material: '', gender: '', purchasePrice: '', sellingPrice: '', stockQty: '', lowStockAlert: '5', barcode: '' }); setModal(true); };
  const openEdit = f => { setEditFrame(f); setForm({ brand: f.brand, model: f.model || '', shape: f.shape, size: f.size || '', color: f.color || '', material: f.material || '', gender: f.gender || '', purchasePrice: f.purchasePrice, sellingPrice: f.sellingPrice, stockQty: f.stockQty, lowStockAlert: f.lowStockAlert, barcode: f.barcode || '' }); setModal(true); };

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
      setModal(false); load(search, filters);
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const del = async (id) => {
    const ok = window.confirm("Delete this frame?");
    if (!ok) return;

    try {
      await api.delete(`/frames/${id}`);

      // ✅ Update UI AFTER success
      setFrames(prev => prev.filter(f => f.id !== id));

      toast.success("Frame deleted");

      // Close modal if needed
      if (selectedFrame?.id === id) {
        setSelectedFrame(null);
      }

    } catch (e) {
      if (e.response?.status === 403) {
        toast.error("Only admin can delete frames");
      } else {
        toast.error(e.response?.data?.message || "Failed to delete");
      }

      load(search, filters);
    }
  };

  return (
    <div>
      <PageHeader title="Frames" subtitle={`${frames.length} items`}
        action={canManageFrames && <button className="btn-primary btn-md" onClick={openAdd}><Plus size={15} /> Add Frame</button>} />

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search brand, model, barcode…" className="flex-1 min-w-48 max-w-72" />
        <select className="field-select w-40" value={filters.brand} onChange={e => setFilters(f => ({ ...f, brand: e.target.value }))}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="field-select w-44" value={filters.shape} onChange={e => setFilters(f => ({ ...f, shape: e.target.value }))}>
          <option value="">All Shapes</option>
          {SHAPES.map(s => <option key={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Grid size={15} /></button>
          <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><List size={15} /></button>
        </div>
      </div>

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
                {canManageFrames && (
                  <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(fr)} className="btn-secondary btn-xs shadow-sm">Edit</button>
                    <button onClick={() => del(fr.id)} className="btn-danger btn-xs shadow-sm">Del</button>
                  </div>
                )}
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
                  <button
                    onClick={() => {
                      setSelectedFrame(fr);
                      setPrintQty(1); // reset
                    }}
                    className="btn-secondary btn-xs w-full"
                  >
                    Label
                  </button>
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
                    {canManageFrames && (
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(fr)} className="btn-ghost btn-xs">Edit</button>
                        <button onClick={() => del(fr.id)} className="btn-danger btn-xs">Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={handleModalClose} title={editFrame ? 'Edit Frame' : 'Add Frame'} size="lg"
        footer={<>
          <button className="btn-secondary btn-md" onClick={handleModalClose}>Cancel</button>
          <button className="btn-primary btn-md" onClick={save} disabled={saving}>{saving ? 'Saving…' : editFrame ? 'Update' : 'Add Frame'}</button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="field-label">Brand *</label><input className="field-input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} /></div>
          <div><label className="field-label">Model</label><input className="field-input" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
          <div><label className="field-label">Shape</label><select className="field-select" value={form.shape} onChange={e => setForm(f => ({ ...f, shape: e.target.value }))}>{SHAPES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
          <div><label className="field-label">Size</label><input className="field-input" value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} /></div>
          <div><label className="field-label">Color</label><input className="field-input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
          <div><label className="field-label">Material</label><input className="field-input" value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} /></div>
          <div><label className="field-label">Gender</label><select className="field-select" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option value="">Unisex</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
          <div>
            <label className="field-label">Barcode</label>
            <div className="flex gap-2 mb-2">
              <input
                className="field-input flex-1 font-mono"
                value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="Scan or enter barcode number"
              />
              <button type="button" onClick={handleGenerateBarcode} className="btn-secondary btn-sm whitespace-nowrap" title="Auto-generate EAN-13">
                🔄 Generate
              </button>
              <button type="button" onClick={toggleScanner} className={`btn-sm whitespace-nowrap ${scanning ? 'btn-danger' : 'btn-secondary'}`} title={scanning ? 'Stop camera' : 'Scan with camera'}>
                {scanning ? '⏹ Stop' : '📷 Scan'}
              </button>
            </div>

            {/* Camera feed */}
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
              <div className="text-xs text-blue-600 font-medium mt-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                Scanning... Point camera at barcode
              </div>
            )}
          </div>
          <div><label className="field-label">Model Code</label><input className="field-input" value={form.modelCode || ''} onChange={e => setForm(f => ({ ...f, modelCode: e.target.value }))}/></div>
          <div><label className="field-label">Purchase Price ₹</label><input className="field-input" type="number" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} /></div>
          <div><label className="field-label">Selling Price ₹ *</label><input className="field-input" type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} /></div>
          <div><label className="field-label">Stock Qty</label><input className="field-input" type="number" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} /></div>
          <div><label className="field-label">Low Stock Alert</label><input className="field-input" type="number" value={form.lowStockAlert} onChange={e => setForm(f => ({ ...f, lowStockAlert: e.target.value }))} /></div>
          {form.purchasePrice && form.sellingPrice && (
            <div className="col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm">
              <span className="text-emerald-700 font-semibold">Margin: {Math.round((form.sellingPrice - form.purchasePrice) / form.sellingPrice * 100)}%</span>
              <span className="text-emerald-600 ml-3">Profit: {fmt(form.sellingPrice - form.purchasePrice)} per unit</span>
            </div>
          )}
        </div>
      </Modal>

      {selectedFrame && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg">

            <div className="mt-4 flex items-center gap-2">

              <label className="text-sm font-medium">Quantity:</label>
              <input
                type="number"
                min="1"
                value={printQty}
                onChange={(e) => setPrintQty(Math.max(1, Number(e.target.value)))}
                className="field-input w-20"
              />
            </div>

            {/* Preview only */}
            <Label key={selectedFrame.id} product={selectedFrame} />

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setSelectedFrame(null)}
              >
                Close
              </button>

              {/* REAL PRINT */}
              <PrintLabelButton
                product={selectedFrame}
                quantity={printQty}
                className="btn-primary btn-sm"
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
