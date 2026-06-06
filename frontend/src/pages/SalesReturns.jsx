import { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw, RefreshCw, History, PackageCheck } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function SalesReturns() {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [reason, setReason] = useState('');
  const [returnedAt, setReturnedAt] = useState(todayInput());
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const location = useLocation();

  const loadHistory = async () => {
    const res = await api.get('/returns', { params: { limit: 10 } });
    setHistory(res.data.data || []);
  };

  useEffect(() => {
    loadHistory().catch(() => {});
  }, []);

  useEffect(() => {
  if (location.state?.orderId) {
    setOrders([]);
    loadOrder(location.state.orderId);
  }
}, [location.state]);

  const findOrders = async () => {
    if (!search.trim()) return toast.error('Enter invoice/order number or customer details');
    setLoading(true);
    try {
      const res = await api.get('/orders', { params: { search: search.trim(), limit: 8 } });
      setOrders(res.data.data || []);
      if (!res.data.data?.length) toast.error('No matching orders found');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to search orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrder = async (orderId) => {
    setLoading(true);
    try {
      const res = await api.get(`/returns/order/${orderId}/preview`);
      setSelectedOrder(res.data.data);
      setReturnQty({});
      setReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load return details');
    } finally {
      setLoading(false);
    }
  };

  const selectedItems = useMemo(() => {
    if (!selectedOrder) return [];
    return selectedOrder.items
      .map(item => {
        const quantity = Math.max(0, Number(returnQty[item.id] || 0));
        return {
          orderItemId: item.id,
          name: item.name,
          quantity,
          refundAmount: Number(item.unitRefund || 0) * quantity,
        };
      })
      .filter(item => item.quantity > 0);
  }, [returnQty, selectedOrder]);

  const refundAmount = selectedItems.reduce((sum, item) => sum + item.refundAmount, 0);

  const setFullReturn = () => {
    if (!selectedOrder) return;
    setReturnQty(Object.fromEntries(selectedOrder.items.map(item => [item.id, item.availableQty])));
  };

  const submitReturn = async () => {
    if (!selectedOrder) return;
    if (!selectedItems.length) return toast.error('Select at least one item quantity to return');
    if (!reason.trim()) return toast.error('Return reason is required');

    setSaving(true);
    try {
      await api.post('/returns', {
        orderId: selectedOrder.id,
        reason: reason.trim(),
        returnedAt: new Date(returnedAt).toISOString(),
        items: selectedItems.map(({ orderItemId, quantity }) => ({ orderItemId, quantity })),
      });
      toast.success('Sales return recorded and stock updated');
      await Promise.all([loadHistory(), loadOrder(selectedOrder.id)]);
      setReturnQty({});
      setReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record return');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Return</h1>
          <p className="text-sm text-slate-500 mt-0.5">Return items from an existing invoice and restore stock automatically</p>
        </div>
        <button onClick={loadHistory} className="btn-secondary btn-md"><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="card p-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field-input pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') findOrders(); }}
              placeholder="Search invoice number, customer name, or phone"
            />
          </div>
          <button onClick={findOrders} disabled={loading} className="btn-primary btn-md">
            <Search size={15} /> Search
          </button>
        </div>

        {orders.length > 0 && (
          <div className="mt-4 grid gap-2">
            {orders.map(order => (
              <button
                key={order.id}
                onClick={() => loadOrder(order.id)}
                className={`text-left border rounded-xl p-3 hover:border-primary-300 hover:bg-primary-50 transition ${selectedOrder?.id === order.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{order.orderNumber}</div>
                    <div className="text-xs text-slate-500">{order.customer?.name} · {order.customer?.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{fmt(order.totalAmount)}</div>
                    <div className="text-xs text-slate-400">{format(new Date(order.createdAt), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-500">{selectedOrder.customer?.name} · Returnable items</p>
              </div>
              <button onClick={setFullReturn} className="btn-secondary btn-sm"><PackageCheck size={14} /> Full Return</button>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th className="text-right">Sold</th>
                    <th className="text-right">Returned</th>
                    <th className="text-right">Return Qty</th>
                    <th className="text-right">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map(item => {
                    const qty = Number(returnQty[item.id] || 0);
                    return (
                      <tr key={item.id}>
                        <td className="font-semibold text-slate-800">{item.name}</td>
                        <td><span className="badge badge-gray capitalize">{item.itemType}</span></td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{item.returnedQty}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            max={item.availableQty}
                            value={returnQty[item.id] ?? ''}
                            disabled={item.availableQty <= 0}
                            onChange={e => {
                              const next = Math.min(item.availableQty, Math.max(0, Number(e.target.value || 0)));
                              setReturnQty(current => ({ ...current, [item.id]: next }));
                            }}
                            className="field-input w-24 text-right"
                          />
                        </td>
                        <td className="text-right font-bold">{fmt(qty * Number(item.unitRefund || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Refund Amount</div>
              <div className="text-3xl font-black text-slate-900 mt-1">{fmt(refundAmount)}</div>
            </div>
            <div>
              <label className="field-label">Return Date</label>
              <input type="datetime-local" className="field-input" value={returnedAt} onChange={e => setReturnedAt(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Return Reason</label>
              <textarea className="field-input min-h-24" value={reason} onChange={e => setReason(e.target.value)} placeholder="Wrong item, damaged lens, customer exchange..." />
            </div>
            <button onClick={submitReturn} disabled={saving || refundAmount <= 0} className="btn-danger btn-md w-full">
              <RotateCcw size={15} /> {saving ? 'Recording...' : 'Record Return'}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <History size={16} className="text-slate-500" />
          <h3 className="font-bold text-slate-800 text-sm">Recent Return History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Items</th><th>Staff</th><th className="text-right">Refund</th><th>Reason</th></tr></thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-slate-400">No sales returns recorded</td></tr>
              ) : history.map(ret => (
                <tr key={ret.id}>
                  <td>{format(new Date(ret.returnedAt), 'MMM d, yyyy h:mm a')}</td>
                  <td className="font-bold text-primary-700">{ret.order?.orderNumber}</td>
                  <td>{ret.order?.customer?.name || '-'}</td>
                  <td>{ret.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0}</td>
                  <td>{ret.staff?.name || '-'}</td>
                  <td className="text-right font-bold text-red-600">{fmt(ret.refundAmount)}</td>
                  <td className="max-w-xs truncate" title={ret.reason}>{ret.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
