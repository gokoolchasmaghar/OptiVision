import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, Mail, MapPin, User } from 'lucide-react';
import api from '../services/api';
import { Tabs, StatusBadge, Spinner, Empty, Modal } from '../components/ui';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function RxTable({ rx }) {
  const row = (label, right, left) => (
    <tr key={label}>
      <td className="px-4 py-2.5 text-xs font-semibold text-slate-500 bg-slate-50">{label}</td>
      <td className="rx-cell px-4 py-2.5 border-l border-slate-100">{right ?? '—'}</td>
      <td className="rx-cell px-4 py-2.5 border-l border-slate-100">{left ?? '—'}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-slate-100 rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-primary-50">
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500"></th>
            <th className="px-4 py-2 text-center text-xs font-bold text-primary-700">Right Eye (OD)</th>
            <th className="px-4 py-2 text-center text-xs font-bold text-primary-700 border-l border-primary-100">Left Eye (OS)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {row('SPH', rx.rightSph !== null ? rx.rightSph : null, rx.leftSph !== null ? rx.leftSph : null)}
          {row('CYL', rx.rightCyl, rx.leftCyl)}
          {row('AXIS', rx.rightAxis, rx.leftAxis)}
          {row('ADD', rx.rightAdd, rx.leftAdd)}
          {row('PD', rx.rightPd || rx.pd, rx.leftPd || rx.pd)}
        </tbody>
      </table>
      {rx.doctorName && <div className="mt-2 text-xs text-slate-500">Dr. {rx.doctorName} · {format(new Date(rx.date), 'MMM d, yyyy')}</div>}
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cust, setCust] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('rx');
  const [rxModal, setRxModal] = useState(false);
  const [rxForm, setRxForm] = useState({ doctorName: '', rightSph: '', rightCyl: '', rightAxis: '', rightAdd: '', leftSph: '', leftCyl: '', leftAxis: '', leftAdd: '', pd: '' });
  const [savingRx, setSavingRx] = useState(false);

  const load = () => api.get(`/customers/${id}`).then(r => setCust(r.data.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]);

  const saveRx = async () => {
    setSavingRx(true);
    try {
      await api.post('/prescriptions', { ...rxForm, customerId: id });
      toast.success('Prescription saved');
      setRxModal(false);
      load();
    } catch (e) { toast.error('Error saving'); }
    setSavingRx(false);
  };

  const downloadPdfBlob = (data, filename) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadPrescription = async (id) => {
    try {
      const res = await api.get(`/prescriptions/${id}/pdf`, {
        responseType: 'blob',
      });
      downloadPdfBlob(res.data, `Prescription-${id}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download PDF');
    }
  };

  const downloadInvoice = async (orderId, orderNumber) => {
    try {
      const res = await api.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob',
      });
      downloadPdfBlob(res.data, `invoice-${orderNumber}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to download invoice');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  if (!cust) return <div className="text-center text-red-500 py-16">Customer not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/customers')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5 font-medium">
        <ArrowLeft size={15} /> Back to Customers
      </button>

      <div className="grid lg:grid-cols-4 gap-5">
        {/* Profile Card */}
        <div className="card p-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mb-4"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {cust.name[0]}
          </div>
          <h2 className="font-bold text-slate-900 text-lg">{cust.name}</h2>
          {cust.gender && <div className="text-sm text-slate-500 mt-1">{cust.gender} · {cust.age ? `${cust.age} yrs` : ''}</div>}
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-slate-600"><Phone size={14} /> {cust.phone}</div>
            {cust.email && <div className="flex items-center gap-2 text-sm text-slate-600"><Mail size={14} /> {cust.email}</div>}
            {cust.address && <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin size={14} /> {cust.address}</div>}
          </div>
          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
            <div><div className="text-lg font-bold text-slate-800">{cust.orders?.length || 0}</div><div className="text-xs text-slate-500">Orders</div></div>
            <div><div className="text-lg font-bold text-slate-800">{cust.prescriptions?.length || 0}</div><div className="text-xs text-slate-500">Prescriptions</div></div>
          </div>
          <button onClick={() => navigate(`/orders/new?customerId=${id}`)} className="btn-primary btn-sm w-full mt-4 justify-center">
            <Plus size={13} /> New Order
          </button>
        </div>

        {/* Tabs */}
        <div className="lg:col-span-3 space-y-4">
          <Tabs
            tabs={[{ id: 'rx', label: 'Prescriptions' }, { id: 'orders', label: 'Orders' }]}
            active={tab} onChange={setTab}
          />

          {tab === 'rx' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Prescription History</h3>
                <button className="btn-primary btn-sm" onClick={() => setRxModal(true)}><Plus size={13} /> Add Rx</button>
              </div>
              {cust.prescriptions?.length === 0 ? (
                <Empty icon="👓" title="No prescriptions" desc="Add a prescription for this customer" />
              ) : (
                <div className="space-y-5">
                  {cust.prescriptions.map((rx, i) => (
                    <div key={rx.id}>
                      {i > 0 && <div className="border-t border-slate-100 my-5" />}

                      {/* Header badges */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="badge-blue badge">
                          #{cust.prescriptions.length - i}
                        </span>
                        {i === 0 && <span className="badge-green badge">Latest</span>}
                      </div>

                      {/* ✅ Prescription Table */}
                      <RxTable rx={rx} />

                      {/* ✅ Footer (date + download button) */}
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-slate-400">
                          {format(new Date(rx.date), 'MMM d, yyyy')}
                        </span>

                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => downloadPrescription(rx.id)}
                        >
                          ⬇ Download PDF
                        </button>
                      </div>

                      {/* Notes */}
                      {rx.notes && (
                        <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                          {rx.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'orders' && (
            <div className="card overflow-hidden">
              {cust.orders?.length === 0 ? (
                <div className="p-5"><Empty icon="📋" title="No orders" desc="Create an order for this customer" /></div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Order #</th><th>Date</th><th>Amount</th><th>Status</th><th>Payment</th><th></th></tr></thead>
                  <tbody>
                    {cust.orders.map(o => (
                      <tr key={o.id} className="cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                        <td className="font-mono text-primary-600 font-semibold">{o.orderNumber}</td>
                        <td className="text-slate-500 text-xs">{format(new Date(o.createdAt), 'MMM d, yyyy')}</td>
                        <td className="font-semibold">{fmt(o.totalAmount)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td><StatusBadge status={o.paymentStatus} /></td>
                        <td>
                          <div className="flex items-center gap-3 text-xs font-semibold">
                            <button
                              type="button"
                              className="text-slate-500 hover:text-primary-600"
                              onClick={e => {
                                e.stopPropagation();
                                downloadInvoice(o.id, o.orderNumber);
                              }}
                            >
                              Invoice
                            </button>
                            <span className="text-primary-600">View →</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Rx Modal */}
      <Modal open={rxModal} onClose={() => setRxModal(false)} title="Add Prescription" size="lg"
        footer={<>
          <button className="btn-secondary btn-md" onClick={() => setRxModal(false)}>Cancel</button>
          <button className="btn-primary btn-md" onClick={saveRx} disabled={savingRx}>{savingRx ? 'Saving…' : 'Save Prescription'}</button>
        </>}>
        <div className="mb-4">
          <label className="field-label">Doctor Name</label>
          <input className="field-input" value={rxForm.doctorName} onChange={e => setRxForm(f => ({ ...f, doctorName: e.target.value }))} placeholder="Dr. Smith" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-100 rounded-xl overflow-hidden mb-4">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Field</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-blue-700">Right Eye (OD)</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-emerald-700 border-l border-slate-100">Left Eye (OS)</th>
              </tr>
            </thead>
            <tbody>
              {[['SPH', 'Sph'], ['CYL', 'Cyl'], ['AXIS', 'Axis'], ['ADD', 'Add']].map(([label, key]) => (
                <tr key={label} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">{label}</td>
                  <td className="px-3 py-2 border-l border-slate-100">
                    <input className="w-full text-center text-sm border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                      type="number" step="0.25" placeholder="0.00"
                      value={rxForm[`right${key}`]} onChange={e => setRxForm(f => ({ ...f, [`right${key}`]: e.target.value }))} />
                  </td>
                  <td className="px-3 py-2 border-l border-slate-100">
                    <input className="w-full text-center text-sm border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
                      type="number" step="0.25" placeholder="0.00"
                      value={rxForm[`left${key}`]} onChange={e => setRxForm(f => ({ ...f, [`left${key}`]: e.target.value }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <label className="field-label">PD (mm)</label>
          <input className="field-input w-full sm:max-w-xs" type="number" step="0.5" value={rxForm.pd} onChange={e => setRxForm(f => ({ ...f, pd: e.target.value }))} placeholder="63" />
        </div>
      </Modal>
    </div>
  );
}
