import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PageHeader, Tabs, Modal, Spinner, Empty } from '../components/ui';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { isAdmin, isSuperAdmin } from '../utils/roles';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronUp } from 'lucide-react';

const fmt = n => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;

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

  // Stock report actions with independent loading states
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Excel audit workflow states
  const [auditModal, setAuditModal] = useState(false);
  const [auditReview, setAuditReview] = useState(false);
  const [auditChanges, setAuditChanges] = useState([]);
  const [auditNotes, setAuditNotes] = useState('');
  const [submitAudit, setSubmitAudit] = useState(false);

  // Audit history states
  const [auditHistoryModal, setAuditHistoryModal] = useState(false);
  const [audits, setAudits] = useState([]);

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canManageInventory = isAdmin(user);
  const canDownloadStockReport = isSuperAdmin(user);

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
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error adjusting stock');
    } finally {
      setSaving(false);
    }
  };

  const downloadStockReport = async () => {
    setPdfLoading(true);
    try {
      const res = await api.get('/inventory/stock-report/pdf', { responseType: 'blob' });
      const disposition = res.headers['content-disposition'] || '';
      const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || 'stock-report.pdf';
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Stock report downloaded');
    } catch (e) {
      toast.error(e.response?.status === 403 ? 'Only super admin can download stock reports' : 'Failed to download stock report');
    } finally {
      setPdfLoading(false);
      setReportDropdownOpen(false);
    }
  };

  const downloadExcelAudit = async () => {
    setExcelLoading(true);
    try {
      const res = await api.get('/inventory/stock-report/excel', { responseType: 'blob' });
      const disposition = res.headers['content-disposition'] || '';
      const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || 'stock-audit.xlsx';
      const url = URL.createObjectURL(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Excel audit sheet downloaded');
      setAuditModal(true);
    } catch (e) {
      toast.error('Failed to download Excel sheet');
    } finally {
      setExcelLoading(false);
      setReportDropdownOpen(false);
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target.result, { type: 'array' });
        const ws = wb.Sheets['Stock Audit'];
        if (!ws) {
          toast.error('The workbook must contain a "Stock Audit" sheet');
          return;
        }

        const data = XLSX.utils.sheet_to_json(ws);
        const changesByItem = new Map();

        // Filter for changed items (where New Stock differs from Current Stock)
        data.filter(row => {
          const newQty = Number(row['New Stock']);
          const oldQty = Number(row['Current Stock']);
          return Number.isInteger(newQty) && newQty >= 0 && Number.isInteger(oldQty) && newQty !== oldQty && (row.ID || row.Barcode);
        }).forEach(row => {
          const itemType = String(row['Item Type'] || '').trim().toUpperCase();
          const itemId = String(row.ID || '').trim();
          const itemBarcode = String(row.Barcode || '').trim();
          const oldQuantity = Number(row['Current Stock']);
          const newQuantity = Number(row['New Stock']);

          changesByItem.set(`${itemType}:${itemId || itemBarcode}`, {
            itemId,
            itemType,
            itemName: row.Name || itemId,
            itemBarcode,
            oldQuantity,
            newQuantity,
            difference: newQuantity - oldQuantity,
            reason: row.Reason || '',
          });
        });

        const changes = [...changesByItem.values()];

        if (changes.length === 0) {
          toast.error('No changes found in the spreadsheet');
          return;
        }

        setAuditChanges(changes);
        setAuditReview(true);
        setAuditModal(false);
      } catch (err) {
        toast.error('Failed to read Excel file: ' + err.message);
      } finally {
        setUploadLoading(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setUploadLoading(false);
      e.target.value = '';
      toast.error('Failed to read Excel file');
    };
    reader.readAsArrayBuffer(file);
  };

  const submitAuditChanges = async () => {
    if (auditChanges.length === 0) return toast.error('No changes to submit');
    setSubmitAudit(true);
    try {
      const res = await api.post('/inventory/audit/submit', {
        items: auditChanges,
        notes: auditNotes,
      });
      if (res.data.success) {
        toast.success(res.data.data.message);
        setAuditChanges([]);
        setAuditNotes('');
        setAuditReview(false);
        load();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit audit');
    } finally {
      setSubmitAudit(false);
    }
  };

  const loadAuditHistory = async () => {
    setHistoryLoading(true);
    setAuditHistoryModal(true);
    setReportDropdownOpen(false);
    try {
      const res = await api.get('/inventory/audits?limit=50');
      if (res.data.success) {
        setAudits(res.data.data.audits);
      }
    } catch (e) {
      toast.error('Failed to load audit history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const confirmAudit = async (auditId) => {
    if (!window.confirm('Confirm this audit? All changes will be applied to inventory.')) return;

    try {
      const res = await api.post(`/inventory/audit/${auditId}/confirm`);
      if (res.data.success) {
        toast.success(res.data.data.message);
        loadAuditHistory();
        load();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to confirm audit');
    }
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
            {canDownloadStockReport && (
              <div className="relative">
                <button
                  className="btn-secondary btn-md"
                  onClick={() => setReportDropdownOpen(!reportDropdownOpen)}
                >
                  Stock Report
                  {reportDropdownOpen ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
                {reportDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-48">
                    <button
                      onClick={downloadStockReport}
                      disabled={pdfLoading}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 text-sm flex items-center gap-2 disabled:opacity-60"
                    >
                      {pdfLoading ? <Spinner size={16} /> : '📄'}
                      {pdfLoading ? 'Preparing...' : 'Download PDF Report'}
                    </button>
                    <button
                      onClick={() => { setAuditModal(true); setReportDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 text-sm flex items-center gap-2"
                    >
                      📊 Stock Audit
                    </button>
                    <button
                      onClick={loadAuditHistory}
                      disabled={historyLoading}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm flex items-center gap-2 disabled:opacity-60"
                    >
                      {historyLoading ? <Spinner size={16} /> : '📜'}
                      {historyLoading ? 'Loading...' : 'Audit History'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button className="btn-primary btn-md" onClick={() => setAdjModal(true)}>
              Adjust Stock
            </button>
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
                          <span className={`badge text-xs ${m.type === 'IN' || m.type === 'RETURN' ? 'badge-green'
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

      {/* ── Stock Audit Modal ── */}
      <Modal
        open={auditModal}
        onClose={() => setAuditModal(false)}
        title="Stock Audit"
        footer={
          <>
            <button className="btn-secondary btn-md" onClick={() => setAuditModal(false)}>Close</button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="border-b pb-6">
            <h3 className="font-bold text-slate-800 mb-3">📤 Upload Audited Excel</h3>
            <p className="text-sm text-slate-600 mb-4">
              Upload an Excel file with updated stock quantities. The "New Stock" column will be compared against current inventory.
            </p>
            <label className="block">
              <span className={`btn-primary btn-md cursor-pointer inline-flex items-center gap-2 ${uploadLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                {uploadLoading ? <Spinner size={16} /> : '📁'}
                {uploadLoading ? 'Processing...' : 'Choose Excel File'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  disabled={uploadLoading}
                  className="hidden"
                />
              </span>
            </label>
            <p className="text-xs text-slate-400 mt-2">Supports .xlsx and .xls formats</p>
          </div>

          {/* Download Section */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3">📥 Download Template</h3>
            <p className="text-sm text-slate-600 mb-4">
              Download the current inventory as an Excel template. Edit it offline and upload when ready.
            </p>
            <button
              onClick={downloadExcelAudit}
              disabled={excelLoading}
              className={`btn-secondary btn-md inline-flex items-center gap-2 ${excelLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {excelLoading ? <Spinner size={16} /> : '⬇️'}
              {excelLoading ? 'Preparing...' : 'Download Excel Template'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Audit Review Modal ── */}
      <Modal
        open={auditReview}
        onClose={() => setAuditReview(false)}
        title="Review Stock Changes"
        footer={
          <>
            <button className="btn-secondary btn-md" onClick={() => setAuditReview(false)}>Cancel</button>
            <button className="btn-primary btn-md" onClick={submitAuditChanges} disabled={submitAudit}>
              {submitAudit ? 'Submitting…' : 'Submit Audit'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Audit Notes (optional)</label>
            <textarea
              className="field-input"
              rows="3"
              value={auditNotes}
              onChange={e => setAuditNotes(e.target.value)}
              placeholder="Add notes for this audit…"
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="tbl w-full text-xs">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Current</th>
                  <th>New</th>
                  <th className="text-center">Diff</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditChanges.map((change, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-slate-700">{change.itemName}</td>
                    <td>{change.oldQuantity}</td>
                    <td className="font-bold">{change.newQuantity}</td>
                    <td className={`text-center font-bold ${change.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change.difference > 0 ? '+' : ''}{change.difference}
                    </td>
                    <td className="text-slate-500">{change.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg text-sm">
            <strong>Summary:</strong> {auditChanges.length} items with {auditChanges.reduce((sum, c) => sum + c.difference, 0)} total unit changes
          </div>
        </div>
      </Modal>

      {/* ── Audit History Modal ── */}
      <Modal
        open={auditHistoryModal}
        onClose={() => setAuditHistoryModal(false)}
        title="Audit History"
        width="w-4/5"
      >
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex justify-center py-8"><Spinner size={28} /></div>
          ) : audits.length === 0 ? (
            <Empty icon="📋" title="No audits yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[800px] text-xs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Items</th>
                    <th className="text-center">Status</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map(audit => (
                    <tr key={audit.id}>
                      <td className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(audit.submittedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="font-semibold text-slate-700">{audit.user?.name || 'Unknown user'}</td>
                      <td className="text-center font-bold">{audit.items?.length || 0}</td>
                      <td className="text-center">
                        <span className={`badge text-xs ${audit.status === 'PENDING' ? 'badge-yellow'
                            : audit.status === 'CONFIRMED' ? 'badge-green'
                              : 'badge-red'
                          }`}>{audit.status}</span>
                      </td>
                      <td className="text-slate-500 truncate max-w-xs">{audit.notes || '—'}</td>
                      <td className="space-x-2">
                        {audit.status === 'PENDING' && (
                          <button
                            className="text-primary-600 hover:underline"
                            onClick={() => confirmAudit(audit.id)}
                          >
                            Confirm
                          </button>
                        )}
                        {audit.confirmedBy && (
                          <span className="text-xs text-slate-400">
                            ✓ by {audit.confirmedBy.name || 'Unknown user'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
