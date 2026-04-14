import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, CreditCard, Check, Download, MessageCircle, ReceiptText, X } from 'lucide-react';
import api from '../services/api';
import { StatusBadge, Modal, Spinner } from '../components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const STATUS_FLOW = ['CREATED', 'LENS_ORDERED', 'GRINDING', 'FITTING', 'READY', 'DELIVERED'];
const NEXT_MAP = { CREATED: 'LENS_ORDERED', LENS_ORDERED: 'GRINDING', GRINDING: 'FITTING', FITTING: 'READY', READY: 'DELIVERED' };

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', note: '' });
  const [saving, setSaving] = useState(false);
  const [invoiceMenu, setInvoiceMenu] = useState(false);
  const invoiceMenuRef = useRef(null);

  const load = () => api.get(`/orders/${id}`).then(r => setOrder(r.data.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!invoiceMenu) return;
    const onClickOutside = event => {
      if (invoiceMenuRef.current && !invoiceMenuRef.current.contains(event.target)) {
        setInvoiceMenu(false);
      }
    };
    const onEscape = event => {
      if (event.key === 'Escape') setInvoiceMenu(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [invoiceMenu]);

  const advanceStatus = async () => {
    const next = NEXT_MAP[order.status];
    if (!next) return;
    try { await api.patch(`/orders/${id}/status`, { status: next }); toast.success(`→ ${next.replace('_', ' ')}`); load(); }
    catch { toast.error('Failed to update status'); }
  };

  const savePayment = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('Enter valid amount');
    setSaving(true);
    try { await api.post(`/orders/${id}/payment`, payForm); toast.success('Payment recorded'); setPayModal(false); load(); }
    catch { toast.error('Failed to record payment'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  if (!order) return <div className="text-center text-red-500 py-16">Order not found</div>;

  const curIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = NEXT_MAP[order.status];
  const paidAmount = Math.max(0, Number(order.totalAmount || 0) - Number(order.balanceAmount || 0));
  const paidPercent = order.totalAmount > 0 ? Math.round((paidAmount / Number(order.totalAmount)) * 100) : 0;

  const fetchInvoiceBlob = async () => {
    const res = await api.get(`/orders/${order.id}/invoice`, {
      responseType: 'blob'
    });
    return res.data;
  };

  const downloadInvoice = async () => {
    try {
      const blob = await fetchInvoiceBlob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      toast.error('Download failed');
    }
  };

  const printInvoice = () => {
    try {
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        toast.error('Popup blocked! Please allow popups.');
        return;
      }

      const paidAmount = Math.max(0, Number(order.totalAmount || 0) - Number(order.balanceAmount || 0));
      const itemRows = order.items.map((i, idx) => `
        <tr>
          <td class="mono">${idx + 1}</td>
          <td>${i.name}</td>
          <td>${String(i.itemType || '').toUpperCase()}</td>
          <td class="right mono">${i.quantity}</td>
          <td class="right mono">INR ${Number(i.unitPrice || 0).toLocaleString('en-IN')}</td>
          <td class="right mono">INR ${Number(i.totalPrice || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

      const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice ${order.orderNumber}</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; }
            .sheet { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
            .head { display: flex; justify-content: space-between; gap: 16px; padding: 24px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; }
            h1 { margin: 0; font-size: 24px; letter-spacing: .02em; }
            .muted { color: #94a3b8; font-size: 12px; margin-top: 4px; }
            .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(148,163,184,.2); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc; }
            .label { color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px; }
            .val { color: #0f172a; font-size: 14px; font-weight: 600; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; }
            thead th { background: #f8fafc; color: #64748b; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; text-align: left; padding: 12px; }
            tbody td { border-bottom: 1px solid #f1f5f9; font-size: 13px; padding: 12px; }
            .right { text-align: right; }
            .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
            .summary-wrap { display: flex; justify-content: flex-end; padding: 18px 24px 24px; }
            .summary { width: 320px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; color: #475569; font-size: 13px; }
            .row.total { border-top: 1px solid #e2e8f0; margin-top: 10px; padding-top: 10px; color: #0f172a; font-size: 16px; font-weight: 800; }
            .row.good { color: #059669; font-weight: 700; }
            .row.due { color: #dc2626; font-weight: 700; }
            .foot { padding: 0 24px 20px; color: #94a3b8; font-size: 11px; }
            @media print {
              body { background: #fff; padding: 0; }
              .sheet { max-width: none; border: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="head">
              <div>
                <h1>Invoice</h1>
                <div class="muted">Order ${order.orderNumber}</div>
              </div>
              <div style="text-align:right">
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background:
                      order.paymentStatus === 'PAID' ? '#d1fae5' :
                      order.paymentStatus === 'PARTIAL' ? '#fef3c7' :
                      order.paymentStatus === 'REFUNDED' ? '#fee2e2' :
                      '#e5e7eb',
                    color:
                      order.paymentStatus === 'PAID' ? '#065f46' :
                      order.paymentStatus === 'PARTIAL' ? '#92400e' :
                      order.paymentStatus === 'REFUNDED' ? '#991b1b' :
                      '#374151'
                  }}
                >
                  {order.paymentStatus}
                </span>
                
                <div class="muted">Issued ${format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}</div>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <div class="label">Bill To</div>
                <div class="val">${order.customer?.name || '-'}</div>
                <div class="val">${order.customer?.phone || '-'}</div>
                <div class="val">${order.customer?.address || '-'}</div>
              </div>
              <div class="card">
                <div class="label">Order Details</div>
                <div class="val">Payment: ${order.paymentMethod || '-'}</div>
                <div class="val">Created: ${format(new Date(order.createdAt), 'MMM d, yyyy')}</div>
                <div class="val">Delivery: ${order.deliveryDate ? format(new Date(order.deliveryDate), 'MMM d, yyyy') : '-'}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th class="right">Qty</th>
                  <th class="right">Unit</th>
                  <th class="right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>

            <div class="summary-wrap">
              <div class="summary">

                <div class="row">
                  <span>Subtotal</span>
                  <span>INR ${Number(order.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>

                ${order.discountAmount > 0 ? `
                  <div class="row">
                    <span>Discount</span>
                    <span>- INR ${Number(order.discountAmount || 0).toLocaleString('en-IN')}</span>
                  </div>` : ''}

                <div class="row">
                  <span>GST (${order.taxPct || 0}%)</span>
                  <span>INR ${Number(order.taxAmount || 0).toLocaleString('en-IN')}</span>
                </div>

                <div class="row total">
                  <span>Total</span>
                  <span>INR ${Number(order.totalAmount || 0).toLocaleString('en-IN')}</span>
                </div>

                ${order.paymentStatus === 'REFUNDED'
                      ? `
                    <div class="row good">
                      <span>Refunded</span>
                      <span style="color:red;">
                        - INR ${Number(order.totalAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    `
                      : `
                    <div class="row good">
                      <span>Paid</span>
                      <span>INR ${paidAmount.toLocaleString('en-IN')}</span>
                    </div>
                    `
                    }

                <div class="row due">
                  <span>Balance Due</span>
                  <span>
                    INR ${order.paymentStatus === 'REFUNDED'
                      ? '0'
                      : Number(order.balanceAmount || 0).toLocaleString('en-IN')
                    }
                  </span>
                </div>

                ${order.paymentStatus === 'REFUNDED'
                      ? `
                    <div style="margin-top:12px; font-size:12px; color:#c0392b;">
                      Full amount refunded to customer.
                    </div>
                    `
                      : ''
                    }

              </div>
            </div>

            <div class="foot">Generated by OptiVision POS</div>
          </div>
        </body>
      </html>
    `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 300);

    } catch (err) {
      console.error(err);
      toast.error('Print failed');
    }
  };

  const shareOnWhatsApp = () => {
    const phone = String(order.customer?.phone || '').replace(/[^\d]/g, '');
    if (!phone) {
      toast.error('Customer phone is missing');
      return;
    }

    const message = `🧾 *Invoice: ${order.orderNumber}*
    👤 ${order.customer?.name}
    💰 Total: ₹${order.totalAmount}

    👉 Download Invoice:
    ${window.location.origin}/api/orders/${order.id}/invoice

    Thank you for choosing us! 😊`;

    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
  };
  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
      await api.delete(`/orders/${id}`, {
        data: {
          reason: "Cancelled by staff"
        }
      });

      toast.success("Order cancelled");
      load();

    } catch (e) {
      toast.error(e?.response?.data?.message || "Cancel failed");
    }
  };

  return (
    <div>
      <button onClick={() => navigate('/orders')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5 font-medium no-print">
        <ArrowLeft size={15} /> Back to Orders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="font-mono font-bold text-xl text-primary-700">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
          </div>
          <p className="text-sm text-slate-500">
            {format(new Date(order.createdAt), 'MMM d, yyyy · h:mm a')} · by {order.staff?.name}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap no-print">
          {/* <button onClick={() => window.print()} className="btn-secondary btn-md"><Printer size={15} /> Print</button> */}
          {order.balanceAmount > 0 && (
            <button onClick={() => { setPayForm({ amount: String(order.balanceAmount), method: 'CASH', note: '' }); setPayModal(true); }}
              className="btn-success btn-md"><CreditCard size={15} /> Collect {fmt(order.balanceAmount)}</button>
          )}
          {/* INVOICE */}
          <div className="relative" ref={invoiceMenuRef}>
            <button
              onClick={() => setInvoiceMenu(v => !v)}
              className={`btn-md ${invoiceMenu ? 'btn-primary' : 'btn-secondary'}`}
            >
              <ReceiptText size={15} /> Invoice
            </button>

            {invoiceMenu && (
              <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-700 text-white flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Invoice Center</div>
                    <div className="text-sm font-semibold mt-0.5">{order.orderNumber}</div>
                    <div className="text-xs text-slate-300 mt-0.5">{format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}</div>
                  </div>
                  <button onClick={() => setInvoiceMenu(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                    <X size={14} />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400">Total</div>
                      <div className="text-xs font-bold text-slate-700">{fmt(order.totalAmount)}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-500">Paid</div>
                      <div className="text-xs font-bold text-emerald-700">{fmt(paidAmount)}</div>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-red-500">Due</div>
                      <div className="text-xs font-bold text-red-700">{fmt(order.balanceAmount)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                      <span>Payment Progress</span>
                      <span>{paidPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, paidPercent))}%` }} />
                    </div>
                  </div>

                  <button
                    onClick={() => { setInvoiceMenu(false); downloadInvoice(); }}
                    className="w-full text-left border border-slate-200 rounded-xl px-3 py-2.5 hover:border-primary-300 hover:bg-primary-50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Download size={15} /></div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Download PDF</div>
                      <div className="text-xs text-slate-500">Save invoice for records</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setInvoiceMenu(false); printInvoice(); }}
                    className="w-full text-left border border-slate-200 rounded-xl px-3 py-2.5 hover:border-primary-300 hover:bg-primary-50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Printer size={15} /></div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Print Invoice</div>
                      <div className="text-xs text-slate-500">Open formatted print preview</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setInvoiceMenu(false); shareOnWhatsApp(); }}
                    className="w-full text-left border border-slate-200 rounded-xl px-3 py-2.5 hover:border-emerald-300 hover:bg-emerald-50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><MessageCircle size={15} /></div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Share on WhatsApp</div>
                      <div className="text-xs text-slate-500">Send invoice link to customer</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {order.status !== 'CANCELLED' && curIdx < 4 && (
            <button
              onClick={handleCancelOrder}
              className="btn-danger btn-md"
            >
              Cancel Order
            </button>
          )}

          {nextStatus && (
            <button onClick={advanceStatus} className="btn-primary btn-md">→ {nextStatus.replace('_', ' ')}</button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Progress timeline */}
          {order.status !== 'CANCELLED' && (
            <div className="card p-5 no-print">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">Order Progress</h3>
              <div className="flex items-start">
                {STATUS_FLOW.map((s, i) => {
                  const done = i <= curIdx;
                  const cur = i === curIdx;
                  return (
                    <div key={s} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0
                          ${done ? (cur ? 'bg-primary-600 text-white ring-4 ring-primary-100' : 'bg-emerald-500 text-white') : 'bg-slate-100 text-slate-400'}`}>
                          {done && !cur ? <Check size={12} /> : i + 1}
                        </div>
                        <div className={`text-[10px] font-semibold text-center leading-tight ${cur ? 'text-primary-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {s.replace('_', '\n')}
                        </div>
                      </div>
                      {i < STATUS_FLOW.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < curIdx ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 text-sm">Order Items</h3></div>
            <table className="tbl">
              <thead><tr><th>Item</th><th>Type</th><th className="text-right">Qty</th><th className="text-right">Unit Price</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id}>
                    <td className="font-semibold text-slate-800">{item.name}</td>
                    <td><span className="badge-gray badge capitalize">{item.itemType}</span></td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right text-slate-500">{fmt(item.unitPrice)}</td>
                    <td className="text-right font-semibold">{fmt(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Bill summary */}
            <div className="px-5 py-4 border-t border-slate-100 space-y-2 bg-slate-50/50">
              {[
                ['Subtotal', fmt(order.subtotal)],

                order.discountAmount > 0
                  ? ['Discount', `−${fmt(order.discountAmount)}`]
                  : null,

                order.redeemPoints > 0
                  ? ['Loyalty Points Used', `−${fmt(order.redeemPoints)}`]
                  : null,

                [`GST ${order.taxPct}%`, fmt(order.taxAmount)],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm text-slate-600"><span>{k}</span><span>{v}</span></div>
              ))}
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2">
                <span>Total</span><span>{fmt(order.totalAmount)}</span>
              </div>
              {order.advanceAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-semibold">
                  <span>Advance Paid</span><span>{fmt(order.advanceAmount)}</span>
                </div>
              )}
              {order.balanceAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600 font-bold">
                  <span>Balance Due</span><span>{fmt(order.balanceAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Prescription */}
          {order.prescription && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Prescription</h3>
              <table className="w-full text-sm border border-slate-100 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-primary-50">
                    <th className="px-4 py-2 text-left text-xs text-slate-500">Field</th>
                    <th className="px-4 py-2 text-center text-xs text-primary-700">Right Eye (OD)</th>
                    <th className="px-4 py-2 text-center text-xs text-primary-700 border-l border-primary-100">Left Eye (OS)</th>
                  </tr>
                </thead>
                <tbody>
                  {[['SPH', 'rightSph', 'leftSph'], ['CYL', 'rightCyl', 'leftCyl'], ['AXIS', 'rightAxis', 'leftAxis'], ['ADD', 'rightAdd', 'leftAdd'], ['PD', 'rightPd', 'leftPd']].map(([l, r, le]) => (
                    <tr key={l} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">{l}</td>
                      <td className="px-4 py-2 text-center font-mono text-sm">{order.prescription[r] ?? (l === 'PD' ? order.prescription.pd : null) ?? '—'}</td>
                      <td className="px-4 py-2 text-center font-mono text-sm border-l border-slate-100">{order.prescription[le] ?? (l === 'PD' ? order.prescription.pd : null) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {order.prescription.doctorName && <p className="text-xs text-slate-400 mt-2">Dr. {order.prescription.doctorName}</p>}
            </div>
          )}

          {/* Payment history */}
          {order.payments?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-bold text-slate-800 text-sm">Payment History</h3></div>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {order.payments.map(p => (
                    <tr key={p.id}>
                      <td>
                        {p.method === 'REFUND'
                          ? <span style={{ color: 'red', fontWeight: 600 }}>REFUND</span>
                          : p.method}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {p.amount < 0 ? (
                          <span style={{ color: 'red', fontWeight: 600 }}>
                            -₹{Math.abs(p.amount).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          `₹${Number(p.amount).toLocaleString('en-IN')}`
                        )}
                      </td>

                      <td>
                        {p.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-3 text-sm">Customer</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                {order.customer?.name?.[0]}
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{order.customer?.name}</div>
                <div className="text-xs text-slate-500">{order.customer?.phone}</div>
              </div>
            </div>
            {order.customer?.email && <div className="text-xs text-slate-500 mb-1">📧 {order.customer.email}</div>}
            {order.customer?.address && <div className="text-xs text-slate-500">📍 {order.customer.address}</div>}
          </div>

          {/* Order Info */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-3 text-sm">Order Info</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Payment', order.paymentMethod],
                ['Created', format(new Date(order.createdAt), 'MMM d, yyyy')],
                order.deliveryDate ? ['Delivery', format(new Date(order.deliveryDate), 'MMM d, yyyy')] : null,
                order.deliveredAt ? ['Delivered', format(new Date(order.deliveredAt), 'MMM d, yyyy')] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium text-slate-800">{v}</span>
                </div>
              ))}
            </div>
            {order.notes && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                📝 {order.notes}
              </div>
            )}
          </div>

          {/* Status log */}
          {order.statusLogs?.length > 0 && (
            <div className="card p-5 no-print">
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Status Timeline</h3>
              <div className="space-y-2.5">
                {order.statusLogs.map((log, i) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-primary-600' : 'bg-slate-300'}`} />
                    <div>
                      <div className="text-xs font-semibold text-slate-700">{log.status.replace('_', ' ')}</div>
                      <div className="text-xs text-slate-400">{format(new Date(log.changedAt), 'MMM d, h:mm a')}</div>
                      {log.note && <div className="text-xs text-slate-500 mt-0.5">{log.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment"
        footer={<>
          <button className="btn-secondary btn-md" onClick={() => setPayModal(false)}>Cancel</button>
          <button className="btn-success btn-md" onClick={savePayment} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="field-label">Amount ₹</label>
            <input className="field-input" type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['CASH', 'UPI', 'CARD'].map(m => (
                <button key={m} onClick={() => setPayForm(f => ({ ...f, method: m }))}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${payForm.method === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {m === 'CASH' ? '💵' : m === 'UPI' ? '📱' : '💳'} {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">Note / Reference</label>
            <input className="field-input" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} placeholder="UPI ref / cheque no." />
          </div>
        </div>
      </Modal>
    </div>
  );
}


