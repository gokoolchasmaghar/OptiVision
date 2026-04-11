// src/pages/Lenses.jsx
import { useEffect, useState, useRef } from 'react';
import { Plus, Check } from 'lucide-react';
import api from '../services/api';
import { Modal, PageHeader, Spinner, Empty, Badge } from '../components/ui';
import toast from 'react-hot-toast';
import { Html5Qrcode } from "html5-qrcode";
import Label from '../components/Label';

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const LENS_TYPES = ['SINGLE_VISION','BIFOCAL','PROGRESSIVE','READING'];
const LENS_INDICES = ['1.50','1.56','1.61','1.67','1.74'];
const COATINGS = ['Anti-Glare','Blue Cut','Anti-Scratch','UV400','Photochromic'];
const TYPE_COLORS = { SINGLE_VISION:'blue', BIFOCAL:'purple', PROGRESSIVE:'green', READING:'orange' };

export default function Lenses() {
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editLens, setEditLens] = useState(null);
  const [form, setForm] = useState({ name:'', lensType:'SINGLE_VISION', lensIndex:'1.56', coating:[], brand:'', purchasePrice:'', sellingPrice:'', stockQty:'100', barcode: '' });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const [selectedLens, setSelectedLens] = useState(null);

  const load = () => api.get('/lenses').then(r => setLenses(r.data.data)).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditLens(null); setForm({ name:'', lensType:'SINGLE_VISION', lensIndex:'1.56', coating:[], brand:'', purchasePrice:'', sellingPrice:'', stockQty:'100', barcode: '' }); setModal(true); };
  const openEdit = l => { setEditLens(l); setForm({ name:l.name, lensType:l.lensType, lensIndex:l.lensIndex, coating:l.coating||[], brand:l.brand||'', purchasePrice:l.purchasePrice, sellingPrice:l.sellingPrice, stockQty:l.stockQty, barcode: l.barcode || '' }); setModal(true); };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setScanning(false);
        document.getElementById("reader-lenses").style.display = "none";
      }).catch(() => {}); // ignore errors
    }
  };

  const toggleScanner = () => {
    if (scanning) {
      stopScanner();
    } else {
      const scanner = new Html5Qrcode("reader-lenses");
      scannerRef.current = scanner;

      const tryStartScanner = (constraints) => {
        scanner.start(
          constraints,
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            setForm(f => ({ ...f, barcode: decodedText }));
            toast.success('Barcode scanned successfully!');
            stopScanner();
          },
          (error) => {
            // ignore scan errors
          }
        ).then(() => {
          setScanning(true);
          document.getElementById("reader-lenses").style.display = "block";
        }).catch((err) => {
          // Try next constraint if available
          if (constraints.facingMode === "environment") {
            tryStartScanner({ facingMode: "user" });
          } else if (constraints.facingMode === "user") {
            tryStartScanner({});
          } else {
            toast.error('Failed to start camera: ' + err);
          }
        });
      };

      tryStartScanner({ facingMode: "environment" });
    }
  };

  const toggleCoating = c => setForm(f => ({ ...f, coating: f.coating.includes(c) ? f.coating.filter(x => x !== c) : [...f.coating, c] }));

  const save = async () => {
    if (!form.name || !form.sellingPrice) return toast.error('Name and price required');
    setSaving(true);
    try {
      if (editLens) { await api.put(`/lenses/${editLens.id}`, form); toast.success('Updated'); }
      else { await api.post('/lenses', form); toast.success('Lens added'); }
      setModal(false); load();
    } catch (e) { toast.error('Error'); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="Lens Catalog" subtitle={`${lenses.length} lens packages`}
        action={<button className="btn-primary btn-md" onClick={openAdd}><Plus size={15}/> Add Lens</button>}/>

      {loading ? <div className="flex justify-center py-16"><Spinner size={28}/></div> :
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lenses.map(l => (
            <div key={l.id} className="card p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <span className={`badge badge-${TYPE_COLORS[l.lensType]||'gray'}`}>{l.lensType.replace('_',' ')}</span>
                <span className="badge-gray badge">1.{l.lensIndex.includes('.')?l.lensIndex.split('.')[1]:l.lensIndex}</span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">{l.name}</h3>
              {l.brand && <div className="text-xs text-slate-500 mb-3">{l.brand}</div>}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(l.coating||[]).map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 rounded-full px-2.5 py-0.5 font-medium">
                    <Check size={9}/> {c}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                <div>
                  <div className="font-bold text-slate-900">{fmt(l.sellingPrice)}</div>
                  <div className="text-xs text-slate-400">Stock: {l.stockQty}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedLens(l)}
                    className="btn-secondary btn-xs w-full"
                  >
                    Print Label
                  </button>
                  <button onClick={() => openEdit(l)} className="btn-ghost btn-xs">Edit</button>
                  <button onClick={async () => { if(confirm('Delete?')){ await api.delete(`/lenses/${l.id}`); load(); } }} className="btn-danger btn-xs">Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>}

      <Modal open={modal} onClose={() => { if (scanning) stopScanner(); setModal(false); }} title={editLens ? 'Edit Lens' : 'Add Lens Package'}
        footer={<><button className="btn-secondary btn-md" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary btn-md" onClick={save} disabled={saving}>{saving?'Saving…':editLens?'Update':'Add Lens'}</button></>}>
        <div className="space-y-4">
          <div><label className="field-label">Lens Name *</label><input className="field-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Standard Blue Cut SV 1.56"/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="field-label">Lens Type</label><select className="field-select" value={form.lensType} onChange={e => setForm(f=>({...f,lensType:e.target.value}))}>{LENS_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
            <div><label className="field-label">Lens Index</label><select className="field-select" value={form.lensIndex} onChange={e => setForm(f=>({...f,lensIndex:e.target.value}))}>{LENS_INDICES.map(i=><option key={i} value={i}>{i}</option>)}</select></div>
            <div><label className="field-label">Brand</label><input className="field-input" value={form.brand} onChange={e => setForm(f=>({...f,brand:e.target.value}))} placeholder="Essilor, Zeiss…"/></div>
            <div><label className="field-label">Stock Qty</label><input className="field-input" type="number" value={form.stockQty} onChange={e => setForm(f=>({...f,stockQty:e.target.value}))}/></div>
            <div><label className="field-label">Purchase Price ₹</label><input className="field-input" type="number" value={form.purchasePrice} onChange={e => setForm(f=>({...f,purchasePrice:e.target.value}))}/></div>
            <div><label className="field-label">Selling Price ₹ *</label><input className="field-input" type="number" value={form.sellingPrice} onChange={e => setForm(f=>({...f,sellingPrice:e.target.value}))}/></div>
          </div>
          <div>
            <label className="field-label">Barcode</label>
            <div className="flex gap-2">
              <input
                className="field-input flex-1"
                value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="Scan or type"
              />
              <button
                type="button"
                onClick={toggleScanner}
                className="btn-secondary btn-sm"
              >
                {scanning ? "Stop Scan" : "📷"}
              </button>
            </div>
            {/* Scanner container */}
            {scanning && (
              <div className="text-sm text-blue-600 font-medium mt-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Scanning for QR code... Point camera at the barcode.
              </div>
            )}
            <div
              id="reader-lenses"
              style={{
                width: "100%",
                maxWidth: "400px",
                height: "300px",
                marginTop: "10px",
                display: "none",
                border: scanning ? "2px solid #3b82f6" : "none",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            ></div>
          </div>
          <div>
            <label className="field-label">Coatings</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COATINGS.map(c => (
                <button key={c} onClick={() => toggleCoating(c)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.coating.includes(c) ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {form.coating.includes(c) && <Check size={10}/>} {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {selectedLens && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg">

            <Label product={selectedLens} />

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setSelectedLens(null)}
              >
                Close
              </button>

              <button
                className="btn-primary btn-sm"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
