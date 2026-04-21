import { useEffect, useState, useRef } from 'react';
import { Plus, Check } from 'lucide-react';
import api from '../services/api';
import { Modal, PageHeader, Spinner, Empty } from '../components/ui';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import Label, { PrintLabelButton } from '../components/Label';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const LENS_TYPES = ['SINGLE_VISION', 'BIFOCAL', 'PROGRESSIVE', 'READING'];
const LENS_INDICES = ['1.50', '1.56', '1.61', '1.67', '1.74'];
const COATINGS = ['Anti-Glare', 'Blue Cut', 'Anti-Scratch', 'UV400', 'Photochromic'];
const TYPE_COLORS = { SINGLE_VISION: 'blue', BIFOCAL: 'purple', PROGRESSIVE: 'green', READING: 'orange' };

const EMPTY_FORM = {
  name: '', lensType: 'SINGLE_VISION', lensIndex: '1.56',
  coating: [], brand: '', purchasePrice: '', sellingPrice: '',
  stockQty: '100', barcode: ''
};

export default function Lenses() {
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editLens, setEditLens] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedLens, setSelectedLens] = useState(null);
  const [printQty, setPrintQty] = useState(1);
  const scannerRef = useRef(null);
  const scannerReadyRef = useRef(false);

  const load = () =>
    api.get('/lenses')
      .then(r => setLenses(r.data.data))
      .catch(() => toast.error('Failed to load lenses'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditLens(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = l => {
    setEditLens(l);
    setForm({
      name: l.name, lensType: l.lensType, lensIndex: l.lensIndex,
      coating: l.coating || [], brand: l.brand || '',
      purchasePrice: l.purchasePrice, sellingPrice: l.sellingPrice,
      stockQty: l.stockQty, barcode: l.barcode || ''
    });
    setModal(true);
  };

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

    await new Promise(r => setTimeout(r, 50));

    const scanner = new Html5Qrcode('reader-lenses');
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

  const handleModalClose = () => {
    if (scanning) stopScanner();
    setModal(false);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const toggleCoating = c => setForm(f => ({
    ...f,
    coating: f.coating.includes(c) ? f.coating.filter(x => x !== c) : [...f.coating, c]
  }));

  const save = async () => {
    if (!form.name || !form.sellingPrice) return toast.error('Name and price required');
    setSaving(true);
    try {
      if (editLens) {
        await api.put(`/lenses/${editLens.id}`, form);
        toast.success('Lens updated');
      } else {
        await api.post('/lenses', {
          ...form,
          barcode: form.barcode?.trim() || undefined,
          sellingPrice: Number(form.sellingPrice),
          purchasePrice: Number(form.purchasePrice) || 0,
          stockQty: Number(form.stockQty) || 0,
        });
        toast.success('Lens added');
      }
      setModal(false);
      load();
    } catch { toast.error('Error saving lens'); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title="Lens Catalog"
        subtitle={`${lenses.length} lens packages`}
        action={<button className="btn-primary btn-md" onClick={openAdd}><Plus size={15} /> Add Lens</button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : lenses.length === 0 ? (
        <div className="card"><Empty icon="🔬" title="No lenses found" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lenses.map(l => (
            <div key={l.id} className="card p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <span className={`badge badge-${TYPE_COLORS[l.lensType] || 'gray'}`}>{l.lensType.replace('_', ' ')}</span>
                <span className="badge-gray badge">{l.lensIndex}</span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">{l.name}</h3>
              {l.brand && <div className="text-xs text-slate-500 mb-3">{l.brand}</div>}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(l.coating || []).map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 rounded-full px-2.5 py-0.5 font-medium">
                    <Check size={9} /> {c}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                <div>
                  <div className="font-bold text-slate-900">{fmt(l.sellingPrice)}</div>
                  <div className="text-xs text-slate-400">Stock: {l.stockQty}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedLens(l); setPrintQty(1); }} className="btn-secondary btn-xs">Print Label</button>
                  <button onClick={() => openEdit(l)} className="btn-ghost btn-xs">Edit</button>
                  <button onClick={async () => { if (confirm('Delete?')) { await api.delete(`/lenses/${l.id}`); load(); } }} className="btn-danger btn-xs">Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={handleModalClose}
        title={editLens ? 'Edit Lens' : 'Add Lens Package'}
        footer={
          <>
            <button className="btn-secondary btn-md" onClick={handleModalClose}>Cancel</button>
            <button className="btn-primary btn-md" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editLens ? 'Update' : 'Add Lens'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Lens Name *</label>
            <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Standard Blue Cut SV 1.56" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Lens Type</label>
              <select className="field-select" value={form.lensType} onChange={e => setForm(f => ({ ...f, lensType: e.target.value }))}>
                {LENS_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Lens Index</label>
              <select className="field-select" value={form.lensIndex} onChange={e => setForm(f => ({ ...f, lensIndex: e.target.value }))}>
                {LENS_INDICES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Brand</label>
              <input className="field-input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Essilor, Zeiss…" />
            </div>
            <div>
              <label className="field-label">Stock Qty</label>
              <input className="field-input" type="number" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Purchase Price ₹</label>
              <input className="field-input" type="number" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Selling Price ₹ *</label>
              <input className="field-input" type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} />
            </div>
          </div>

          {/* Coatings */}
          <div>
            <label className="field-label">Coatings</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COATINGS.map(c => (
                <button key={c} type="button" onClick={() => toggleCoating(c)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.coating.includes(c) ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {form.coating.includes(c) && <Check size={10} />} {c}
                </button>
              ))}
            </div>
          </div>

          {/* Barcode */}
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
              id="reader-lenses"
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
      {selectedLens && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-[95vw]">

            {/* Quantity */}
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

            <Label product={selectedLens} />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setSelectedLens(null)}
              >
                Close
              </button>

              <PrintLabelButton
                product={selectedLens}
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