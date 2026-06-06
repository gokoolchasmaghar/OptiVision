import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Spinner } from '../components/ui';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const productIdentity = item => ({
  itemType: item.itemType,
  frameId: item.frameId || null,
  lensId: item.lensId || null,
  accessoryId: item.accessoryId || null,
});

export default function OrderEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [storePricing, setStorePricing] = useState({ gstEnabled: true, pricesInclusiveOfGst: false });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [orderRes, storeRes] = await Promise.all([
          api.get(`/orders/${id}`),
          api.get('/stores/current'),
        ]);
        const loaded = orderRes.data.data;
        setOrder(loaded);
        setSelectedCustomer(loaded.customer);
        setItems(loaded.items.map(item => ({
          key: item.id,
          ...productIdentity(item),
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPct: item.discountPct || 0,
          hsn: item.hsn || '',
          gstRate: item.gstRate || 0,
        })));
        setDiscountAmount(loaded.discountAmount || 0);
        setRedeemPoints(loaded.redeemPoints || 0);
        setAdvanceAmount(loaded.advanceAmount || 0);
        setPaymentMethod(loaded.paymentMethod || 'CASH');
        setDeliveryDate(loaded.deliveryDate ? loaded.deliveryDate.slice(0, 10) : '');
        setNotes(loaded.notes || '');
        setStorePricing({
          gstEnabled: storeRes.data.data?.gstEnabled !== false,
          taxRate: Number.isFinite(Number(storeRes.data.data?.taxRate)) ? Math.max(0, Number(storeRes.data.data.taxRate)) : 18,
          pricesInclusiveOfGst: storeRes.data.data?.pricesInclusiveOfGst === true,
        });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load bill');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!customerSearch.trim()) return setCustomers([]);
      const res = await api.get('/customers', { params: { search: customerSearch.trim(), limit: 6 } });
      setCustomers(res.data.data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = productSearch.trim();
      const [fr, ln, ac] = await Promise.all([
        api.get('/frames', { params: { search: q, limit: 8 } }),
        api.get('/lenses', { params: { search: q, limit: 6 } }),
        api.get('/accessories', { params: { search: q, limit: 6 } }),
      ]);
      setProducts([
        ...fr.data.data.map(f => ({ ...f, itemType: 'frame', displayName: `${f.brand} ${f.model || ''}`.trim() })),
        ...ln.data.data.map(l => ({ ...l, itemType: 'lens', displayName: l.name })),
        ...ac.data.data.map(a => ({ ...a, itemType: 'accessory', displayName: a.name })),
      ]);
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  const itemTotal = item => {
    const gross = Number(item.unitPrice || 0) * Number(item.quantity || 0);
    const discount = gross * Math.min(Math.max(Number(item.discountPct || 0), 0), 100) / 100;
    return Math.max(0, gross - discount);
  };

  const itemGross = item => Number(item.unitPrice || 0) * Number(item.quantity || 0);
  const itemDiscount = item => itemGross(item) - itemTotal(item);

  const itemGstAmount = item => {
    const rate = storePricing.gstEnabled ? Number(item.gstRate || 0) : 0;
    const netAmount = itemTotal(item);

    if (rate <= 0) return 0;

    if (storePricing.pricesInclusiveOfGst) {
      const taxableValue = netAmount / (1 + rate / 100);
      return netAmount - taxableValue;
    }

    return netAmount * rate / 100;
  };

  const itemPayable = item =>
    itemTotal(item)
    + (storePricing.pricesInclusiveOfGst ? 0 : itemGstAmount(item));

  const subtotal = items.reduce((sum, item) => sum + itemTotal(item), 0);
  const safeDiscount = Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal);
  const itemsPayable = items.reduce((sum, item) => sum + itemPayable(item), 0);
  const maxPoints = selectedCustomer?.id === order?.customerId
    ? Number(selectedCustomer?.loyaltyPoints || 0) + Number(order?.redeemPoints || 0)
    : Number(selectedCustomer?.loyaltyPoints || 0);
  const safeRedeem = Math.min(Math.max(Number(redeemPoints) || 0, 0), maxPoints, Math.max(0, itemsPayable - safeDiscount));
  const total = Math.max(0, itemsPayable - safeDiscount - safeRedeem);
  const safeAdvance = Math.min(Math.max(Number(advanceAmount) || 0, 0), total);
  const balance = Math.max(0, total - safeAdvance);

  const addProduct = product => {
    const key = `${product.itemType}:${product.id}:${Date.now()}`;
    setItems(current => [...current, {
      key,
      itemType: product.itemType,
      frameId: product.itemType === 'frame' ? product.id : null,
      lensId: product.itemType === 'lens' ? product.id : null,
      accessoryId: product.itemType === 'accessory' ? product.id : null,
      name: product.displayName,
      quantity: 1,
      unitPrice: product.sellingPrice,
      discountPct: 0,
      hsn: product.hsn || '',
      gstRate: product.gstRate || 0,
    }]);
    setProductSearch('');
    setProducts([]);
  };

  const updateItem = (key, patch) => {
    setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
  };

  const save = async () => {
    if (!selectedCustomer) return toast.error('Select a customer');
    if (!items.length) return toast.error('Bill must contain at least one item');
    if (!reason.trim()) return toast.error('Edit reason is required');
    setSaving(true);
    try {
      const res = await api.put(`/orders/${id}`, {
        customerId: selectedCustomer.id,
        items: items.map(item => ({
          itemType: item.itemType,
          frameId: item.frameId,
          lensId: item.lensId,
          accessoryId: item.accessoryId,
          name: item.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountPct: Number(item.discountPct || 0),
          hsn: item.hsn || '',
          gstRate: Number(item.gstRate || 0),
        })),
        discountAmount: safeDiscount,
        redeemPoints: safeRedeem,
        advanceAmount: safeAdvance,
        paymentMethod,
        deliveryDate: deliveryDate || null,
        notes,
        reason: reason.trim(),
      });
      toast.success('Bill updated');
      navigate(`/orders/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bill');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  if (!order) return <div className="text-center py-16 text-red-500">Bill not found</div>;

  const locked = order.status === 'CANCELLED' || (order.returns?.length || 0) > 0;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(`/orders/${id}`)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium">
        <ArrowLeft size={15} /> Back to bill
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Bill</h1>
          <p className="text-sm text-slate-500 mt-0.5">{order.orderNumber}</p>
        </div>
        {locked && <span className="badge badge-red">Editing locked</span>}
      </div>

      {locked ? (
        <div className="card p-5 text-sm text-red-600">
          Cancelled bills or bills with sales returns cannot be edited. Create an adjustment/return instead.
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4">
              <label className="field-label">Customer</label>
              {selectedCustomer && (
                <div className="mb-3 rounded-xl bg-primary-50 border border-primary-200 p-3">
                  <div className="font-semibold text-primary-800">{selectedCustomer.name}</div>
                  <div className="text-xs text-primary-600">{selectedCustomer.phone}</div>
                </div>
              )}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="field-input pl-9" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search to change customer" />
              </div>
              {customers.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                  {customers.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomers([]); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <label className="field-label">Add Product</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="field-input pl-9" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search frames, lenses, accessories" />
              </div>
              {products.length > 0 && (
                <div className="mt-2 grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {products.map(p => (
                    <button key={`${p.itemType}-${p.id}`} onClick={() => addProduct(p)} className="text-left p-2.5 border border-slate-100 rounded-xl hover:border-primary-300 hover:bg-primary-50">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{p.displayName}</div>
                          <div className="text-xs text-slate-500 capitalize">{p.itemType}</div>
                        </div>
                        <div className="font-bold text-primary-700">{fmt(p.sellingPrice)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Item</th><th>Type</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">GST</th><th className="text-right">Disc %</th><th className="text-right">Total</th><th></th></tr></thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.key}>
                      <td><input className="field-input min-w-44" value={item.name} onChange={e => updateItem(item.key, { name: e.target.value })} /></td>
                      <td><span className="badge badge-gray capitalize">{item.itemType}</span></td>
                      <td className="text-right"><input className="field-input w-20 text-right" type="number" min="1" value={item.quantity} onChange={e => updateItem(item.key, { quantity: Math.max(1, Number(e.target.value || 1)) })} /></td>
                      <td className="text-right"><input className="field-input w-28 text-right" type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(item.key, { unitPrice: Math.max(0, Number(e.target.value || 0)) })} /></td>
                      <td className="text-right"><div>{Number(item.gstRate || 0).toFixed(2)}%</div><div className="text-xs text-slate-400">{fmt(itemGstAmount(item))}</div></td>
                      <td className="text-right"><input className="field-input w-20 text-right" type="number" min="0" max="100" value={item.discountPct} onChange={e => updateItem(item.key, { discountPct: Math.min(100, Math.max(0, Number(e.target.value || 0))) })} /></td>
                      <td className="text-right font-bold">{fmt(itemPayable(item))}</td>
                      <td><button onClick={() => setItems(current => current.filter(i => i.key !== item.key))} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800">Totals</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Items Total</span><span>{fmt(itemsPayable)}</span></div>
              <div>
                <label className="field-label">Bill Discount ₹</label>
                <input className="field-input" type="number" min="0" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Redeem Points / Amount</label>
                <input className="field-input" type="number" min="0" max={maxPoints} value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} />
                <div className="text-xs text-slate-400 mt-1">Available for this edit: {fmt(maxPoints)}</div>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-slate-100 pt-2"><span>Total</span><span>{fmt(total)}</span></div>
              <div>
                <label className="field-label">Paid / Advance ₹</label>
                <input className="field-input" type="number" min="0" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Payment Method</label>
                <select className="field-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {['CASH', 'UPI', 'CARD', 'MIXED'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex justify-between font-bold text-red-600"><span>Balance</span><span>{fmt(balance)}</span></div>
            </div>
            <div>
              <label className="field-label">Delivery Date</label>
              <input className="field-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea className="field-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Edit Reason *</label>
              <textarea className="field-textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this bill being edited?" />
            </div>
            <button onClick={save} disabled={saving} className="btn-primary btn-lg w-full justify-center">
              <Plus size={15} /> {saving ? 'Saving...' : 'Save Bill Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
