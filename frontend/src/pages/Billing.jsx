import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Plus, Minus, CreditCard, ReceiptText, Smartphone, Wallet, UserRound, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { PageHeader } from '../components/ui';
import toast from 'react-hot-toast';
import { Html5Qrcode } from "html5-qrcode";
const beepRef = useRef(null);

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const DEFAULT_STORE_PRICING = { gstEnabled: true, taxRate: 18 };
const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Cash', Icon: Wallet, active: 'from-emerald-500 to-emerald-600 border-emerald-500 shadow-emerald-200', idle: 'hover:border-emerald-200 hover:bg-emerald-50/70', icon: 'text-emerald-600' },
  { value: 'UPI', label: 'UPI', Icon: Smartphone, active: 'from-sky-500 to-blue-600 border-sky-500 shadow-sky-200', idle: 'hover:border-sky-200 hover:bg-sky-50/70', icon: 'text-sky-600' },
  { value: 'CARD', label: 'Card', Icon: CreditCard, active: 'from-violet-500 to-fuchsia-600 border-violet-500 shadow-violet-200', idle: 'hover:border-violet-200 hover:bg-violet-50/70', icon: 'text-violet-600' },
];

export default function Billing() {
  const navigate = useNavigate();
  const [custSearch, setCustSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selCustomer, setSelCustomer] = useState(null);
  const [prodSearch, setProdSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef(null);
  const scannerRef = useRef(null);
  const scannerActiveRef = useRef(false);
  const scannerStartingRef = useRef(false);
  const scanLockRef = useRef(false);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [payMethod, setPayMethod] = useState('CASH');
  const [saving, setSaving] = useState(false);
  const [storePricing, setStorePricing] = useState(DEFAULT_STORE_PRICING);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(0);

  const searchCust = async q => {
    if (!q) { setCustomers([]); return; }
    const r = await api.get('/customers', { params: { search: q, limit: 6 } });
    setCustomers(r.data.data);
  };

  const searchProd = async q => {
    const [fr, ln, ac] = await Promise.all([
      api.get('/frames', { params: { search: q, limit: 8 } }),
      api.get('/lenses', { params: { search: q, limit: 6 } }),
      api.get('/accessories', { params: { search: q, limit: 4 } }),
    ]);
    const all = [
      ...fr.data.data.map(f => ({ ...f, itemType: 'frame', displayName: `${f.brand} ${f.model || ''}`.trim() })),
      ...ln.data.data.map(l => ({ ...l, itemType: 'lens', displayName: l.name })),
      ...ac.data.data.map(a => ({ ...a, itemType: 'accessory', displayName: a.name })),
    ];
    setProducts(all);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const addBarcodeToCart = async (barcode, { showToast = false } = {}) => {
    const code = String(barcode || '').trim();
    if (!code) return false;

    try {
      const res = await api.get(`/barcode/${code}`);

      const product = res.data.data;

      addToCart({
        ...product,
        itemType: res.data.type.toLowerCase(),
        displayName:
          res.data.type === 'FRAME'
            ? `${product.brand} ${product.model || ''}`
            : product.name,
      });

      // 🔊 BEEP
      if (beepRef.current) {
        beepRef.current.currentTime = 0;
        beepRef.current.play().catch(() => { });
      }

      if (showToast) toast.success('Product added');
      return true;

    } catch (e) {
      if (showToast) toast.error('Product not found');
      return false;
    }
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;

    scannerStartingRef.current = false;
    scanLockRef.current = false;

    if (scanner) {
      try {
        if (scannerActiveRef.current) {
          await scanner.stop();
        }
      } catch {
        // ignore scanner stop failures
      }

      try {
        await scanner.clear();
      } catch {
        // ignore scanner clear failures
      }
    }

    scannerActiveRef.current = false;
    scannerRef.current = null;
    setScannerOpen(false);
    inputRef.current?.focus();
  };

  const startScanner = async () => {
    if (scannerRef.current || scannerStartingRef.current) return;

    const scanner = new Html5Qrcode('reader');
    scannerRef.current = scanner;
    scannerStartingRef.current = true;
    setScannerOpen(true);

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          if (scanLockRef.current) return;

          scanLockRef.current = true;
          // 🔥 SCAN SUCCESS
          try {
            await addBarcodeToCart(decodedText, { showToast: true });
            const product = res.data.data;

            addToCart({
              ...product,
              itemType: res.data.type.toLowerCase(),
              displayName:
                res.data.type === 'FRAME'
                  ? `${product.brand} ${product.model || ''}`
                  : product.name,
            });

            toast.success("Product added");

          } catch {
            toast.error("Product not found");
          }

          await stopScanner();
        },
        () => { }
      );
      scannerActiveRef.current = true;
    } catch {
      scannerRef.current = null;
      setScannerOpen(false);
      toast.error('Camera not supported');
    } finally {
      scannerStartingRef.current = false;
    }
  };

  // 🔊 Beep
  if (beepRef.current) {
    beepRef.current.currentTime = 0;
    beepRef.current.play().catch(() => { });
  }

  // 🎯 Focus again
  setScanInput('');
  focusInput();

  useEffect(() => {
    searchProd('');
    api.get('/stores/current').then(r => setStorePricing({
      gstEnabled: r.data.data?.gstEnabled !== false,
      taxRate: Number.isFinite(Number(r.data.data?.taxRate)) ? Math.max(0, Number(r.data.data.taxRate)) : 18,
    })).catch(() => { });
  }, []);
  useEffect(() => { const t = setTimeout(() => searchCust(custSearch), 300); return () => clearTimeout(t); }, [custSearch]);
  useEffect(() => { const t = setTimeout(() => searchProd(prodSearch), 300); return () => clearTimeout(t); }, [prodSearch]);
  useEffect(() => () => { void stopScanner(); }, []);
  useEffect(() => {
    beepRef.current = new Audio("/beep.mp3"); // place file in public folder
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleScanInput = async (e) => {
    if (e.key === 'Enter') {
      await addBarcodeToCart(scanInput, { showToast: true });
      setScanInput('');
      focusInput();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addToCart = item => {
    setCart(c => {
      const ex = c.find(x => x.id === item.id && x.itemType === item.itemType);
      if (ex) return c.map(x => x.id === item.id && x.itemType === item.itemType ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...item, qty: 1 }];
    });
    setProdSearch(''); setProducts([]);
  };

  const updateQty = (id, type, delta) => setCart(c =>
    c.map(x => x.id === id && x.itemType === type ? { ...x, qty: Math.max(1, x.qty + delta) } : x)
  );
  const removeItem = (id, type) => setCart(c => c.filter(x => !(x.id === id && x.itemType === type)));

  const subtotal = cart.reduce((s, x) => s + x.sellingPrice * x.qty, 0);
  const itemCount = cart.reduce((s, x) => s + x.qty, 0);
  const discAmt = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const gstRate = storePricing.gstEnabled ? Number(storePricing.taxRate) || 0 : 0;
  const taxable = subtotal - discAmt;
  const tax = (taxable * gstRate) / 100;
  const loyaltyDiscount = Math.min(Number(redeemPoints) || 0, selCustomer?.loyaltyPoints || 0);
  const total = Math.max(0, taxable + tax - loyaltyDiscount);
  const paidAmount = Math.min(total, Math.max(Number(advance) || 0, 0));
  const balance = Math.max(0, total - (Number(advance) || 0));
  const paymentProgress = total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;
  const fullyPaid = cart.length > 0 && paidAmount >= total;

  const checkout = async () => {
    if (!selCustomer) return toast.error('Select a customer');
    if (cart.length === 0) return toast.error('Cart is empty');
    setSaving(true);
    try {
      const items = cart.map(x => ({
        itemType: x.itemType,
        frameId: x.itemType === 'frame' ? x.id : null,
        lensId: x.itemType === 'lens' ? x.id : null,
        accessoryId: x.itemType === 'accessory' ? x.id : null,
        name: x.displayName,
        quantity: x.qty,
        unitPrice: x.sellingPrice,
        totalPrice: x.sellingPrice * x.qty,
      }));
      const r = await api.post('/orders', {
        customerId: selCustomer.id, items,
        discountAmount: discAmt,
        redeemPoints: loyaltyDiscount,
        advanceAmount: Number(advance) || 0,
        paymentMethod: payMethod,
      });
      toast.success(`Order ${r.data.data.orderNumber} created!`);
      navigate(`/orders/${r.data.data.id}`);
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="Billing" subtitle="Quick billing at the counter" />
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Product search + cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <div className="card p-4">
            <label className="field-label mb-2">Customer</label>
            {selCustomer ? (
              <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                <div>
                  <div className="font-semibold text-primary-800">{selCustomer.name}</div>
                  <div className="text-xs text-primary-600">{selCustomer.phone}</div>
                  <div className="text-xs text-emerald-600 font-semibold mt-1">{selCustomer.loyaltyPoints || 0} Points </div>
                </div>
                <button onClick={() => setSelCustomer(null)} className="text-xs text-slate-500 hover:text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="field-input pl-9" value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Search customer by name or phone…" />
                {customers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {customers.map(c => (
                      <div key={c.id} onClick={() => { setSelCustomer(c); setCustSearch(''); setCustomers([]); }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>{c.name[0]}</div>
                        <div><div className="text-sm font-semibold text-slate-800">{c.name}</div><div className="text-xs text-slate-400">{c.phone}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product search */}
          <div className="card p-4">
            <label className="field-label mb-2">Add Product</label>
            <div className="flex gap-2 mb-2">
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleScanInput}
                placeholder="Scan barcode..."
                className="field-input flex-1"
              />

              <button
                type="button"
                title={scannerOpen ? 'Stop camera scanner' : 'Start camera scanner'}
                onClick={() => {
                  if (scannerOpen || scannerRef.current || scannerStartingRef.current) {
                    void stopScanner();
                    return;
                  }

                  void startScanner();
                }}
                className="btn-secondary h-10 px-3 flex items-center justify-center rounded-xl text-xs font-semibold"
              >
                📷
              </button>
            </div>

            <div
              id="reader"
              style={{
                width: '300px',
                marginTop: '10px',
                display: scannerOpen ? 'block' : 'none'
              }}
            ></div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field-input pl-9" value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search frames, lenses, accessories…" />
            </div>
            {products.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                {products.map(p => (
                  <div key={`${p.itemType}-${p.id}`} onClick={() => addToCart(p)}
                    className="flex items-center gap-2.5 p-2.5 border border-slate-100 rounded-xl hover:border-primary-300 hover:bg-primary-50 cursor-pointer transition-all">
                    <span className="text-xl">{p.itemType === 'frame' ? '👓' : p.itemType === 'lens' ? '🔬' : '🧴'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{p.displayName}</div>
                      <div className="text-xs text-primary-600 font-bold">{fmt(p.sellingPrice)}</div>
                    </div>
                    <Plus size={13} className="text-slate-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Cart ({cart.length})</h3>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600 font-semibold">Clear all</button>}
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">Add products to cart</div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Item</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th><th></th></tr></thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={`${item.itemType}-${item.id}`}>
                      <td>
                        <div className="font-semibold text-slate-800 text-sm">{item.displayName}</div>
                        <div className="text-xs text-slate-400 capitalize">{item.itemType}</div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => updateQty(item.id, item.itemType, -1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Minus size={11} /></button>
                          <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, item.itemType, 1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Plus size={11} /></button>
                        </div>
                      </td>
                      <td className="text-right text-slate-500 text-sm">{fmt(item.sellingPrice)}</td>
                      <td className="text-right font-semibold text-sm">{fmt(item.sellingPrice * item.qty)}</td>
                      <td><button onClick={() => removeItem(item.id, item.itemType)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Checkout summary */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800">Payment Summary</h3>
            <div>
              <label className="field-label">Discount ₹</label>
              <input className="field-input" type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
              <label className="field-label m-2">Use Loyalty Points</label>
              <input className="field-input" type="number" value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} placeholder={`Max ${selCustomer?.loyaltyPoints || 0}`} />
            </div>
            <div>
              <label className="field-label">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['CASH', 'UPI', 'CARD'].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${payMethod === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'}`}>
                    {m === 'CASH' ? '💵' : m === 'UPI' ? '📱' : '💳'} {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Advance ₹</label>
              <input className="field-input" type="number" value={advance} onChange={e => setAdvance(e.target.value)} placeholder="0" />
            </div>

            <div className="divider" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {discAmt > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>−{fmt(discAmt)}</span></div>}
              {loyaltyDiscount > 0 && (<div className="flex justify-between text-emerald-600"><span>Loyalty Points</span><span>−{fmt(loyaltyDiscount)}</span></div>)}
              {gstRate > 0 ? (
                <div className="flex justify-between text-slate-600"><span>{`GST ${gstRate}%`}</span><span>{fmt(tax)}</span></div>
              ) : (
                <div className="flex justify-between text-slate-600"><span>GST</span><span>Off</span></div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-slate-100 pt-2"><span>Total</span><span>{fmt(total)}</span></div>
              {balance > 0 && <div className="flex justify-between text-red-600 font-semibold"><span>Balance Due</span><span>{fmt(balance)}</span></div>}
              {(Number(advance) || 0) >= total && cart.length > 0 && <div className="text-emerald-600 font-semibold text-center text-sm">✅ Fully Paid</div>}
            </div>

            <button onClick={checkout} disabled={saving || cart.length === 0 || !selCustomer}
              className="btn-primary btn-lg w-full justify-center">
              {saving ? 'Processing…' : `🧾 Order Now  ${cart.length > 0 ? fmt(total) : ''}`}
            </button>
          </div>

          {!selCustomer && (
            <div className="card p-4 bg-amber-50 border-amber-200 text-center">
              <div className="text-2xl mb-1">👆</div>
              <div className="text-sm text-amber-700 font-medium">Select a customer first</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
