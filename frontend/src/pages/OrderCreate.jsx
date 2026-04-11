import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import api from '../services/api';
import { Spinner } from '../components/ui';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const STEPS = ['Customer', 'Frame', 'Prescription', 'Lens Package', 'Checkout'];

const DEFAULT_STORE_PRICING = { gstEnabled: true, taxRate: 18 };

export default function OrderCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Customer
  const [custSearch, setCustSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selCustomer, setSelCustomer] = useState(null);

  // Step 2: Frame
  const [frameSearch, setFrameSearch] = useState('');
  const [frames, setFrames] = useState([]);
  const [selFrame, setSelFrame] = useState(null);

  // Step 3: Prescription
  const [prescriptions, setPrescriptions] = useState([]);
  const [selRx, setSelRx] = useState(null);
  const [newRx, setNewRx] = useState({ doctorName:'', rightSph:'', rightCyl:'', rightAxis:'', rightAdd:'', leftSph:'', leftCyl:'', leftAxis:'', leftAdd:'', pd:'' });
  const [useExistingRx, setUseExistingRx] = useState(true);

  // Step 4: Lens
  const [lenses, setLenses] = useState([]);
  const [selLens, setSelLens] = useState(null);

  // Step 5: Checkout
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [payMethod, setPayMethod] = useState('CASH');
  const [delivDate, setDelivDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [storePricing, setStorePricing] = useState(DEFAULT_STORE_PRICING);

  // Load initial customer if passed via URL
  useEffect(() => {
    api.get('/stores/current').then(r => setStorePricing({
      gstEnabled: r.data.data?.gstEnabled !== false,
      taxRate: Number.isFinite(Number(r.data.data?.taxRate)) ? Math.max(0, Number(r.data.data.taxRate)) : 18,
    })).catch(() => {});
    const cid = params.get('customerId');
    if (cid) {
      api.get(`/customers/${cid}`).then(r => { setSelCustomer(r.data.data); setStep(1); });
    }
  }, []);

  const searchCustomers = async q => {
    if (q.length < 1) { setCustomers([]); return; }
    const r = await api.get('/customers', { params: { search: q, limit: 8 } });
    setCustomers(r.data.data);
  };

  const searchFrames = async q => {
    const r = await api.get('/frames', { params: { search: q, limit: 12 } });
    setFrames(r.data.data);
  };

  useEffect(() => { if (step === 1) searchFrames(''); }, [step]);
  useEffect(() => {
    if (step === 2 && selCustomer) {
      api.get(`/prescriptions/customer/${selCustomer.id}`).then(r => setPrescriptions(r.data.data));
    }
  }, [step]);
  useEffect(() => { if (step === 3) api.get('/lenses').then(r => setLenses(r.data.data)); }, [step]);

  // Financials
  const frameCost = selFrame?.sellingPrice || 0;
  const lensCost = selLens ? selLens.sellingPrice * 2 : 0;
  const subtotal = frameCost + lensCost;
  const discountAmt = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const gstRate = storePricing.gstEnabled ? Number(storePricing.taxRate) || 0 : 0;
  const taxable = subtotal - discountAmt;
  const tax = (taxable * gstRate) / 100;
  const total = taxable + tax;
  const balance = Math.max(0, total - advance);

  const handleSubmit = async () => {
    if (!selCustomer || !selFrame) return toast.error('Customer and frame required');
    setSaving(true);
    try {
      let prescriptionId = selRx?.id;
      // Save new prescription if needed
      if (!useExistingRx && (newRx.rightSph || newRx.leftSph)) {
        const rxRes = await api.post('/prescriptions', { ...newRx, customerId: selCustomer.id });
        prescriptionId = rxRes.data.data.id;
      }

      const items = [];
      items.push({ itemType:'frame', frameId:selFrame.id, name:`${selFrame.brand} ${selFrame.model||''}`.trim(), quantity:1, unitPrice:selFrame.sellingPrice, totalPrice:selFrame.sellingPrice });
      if (selLens) items.push({ itemType:'lens', lensId:selLens.id, name:selLens.name, quantity:2, unitPrice:selLens.sellingPrice, totalPrice:selLens.sellingPrice*2 });

      const r = await api.post('/orders', {
        customerId: selCustomer.id,
        prescriptionId,
        items,
        discountAmount: discountAmt,
        advanceAmount: advance,
        paymentMethod: payMethod,
        deliveryDate: delivDate || null,
        notes,
        frameDetails: `${selFrame.brand} ${selFrame.model||''} - ${selFrame.color||''}`.trim(),
        lensDetails: selLens ? `${selLens.name} x2` : '',
      });
      toast.success(`Order ${r.data.data.orderNumber} created!`);
      navigate(`/orders/${r.data.data.id}`);
    } catch (e) { toast.error(e.response?.data?.message || 'Error creating order'); }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5 font-medium">
        <ArrowLeft size={15}/> Back
      </button>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              {i < step ? <Check size={14}/> : i+1}
            </div>
            <div className={`text-xs font-semibold ml-2 hidden sm:block ${i === step ? 'text-primary-600' : i < step ? 'text-emerald-600' : 'text-slate-400'}`}>{s}</div>
            {i < STEPS.length-1 && <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-emerald-300' : 'bg-slate-100'}`}/>}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {/* Step 0: Select Customer */}
        {step === 0 && (
          <div>
            <h2 className="font-bold text-lg text-slate-900 mb-4">Select Customer</h2>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input className="field-input pl-9" value={custSearch} onChange={e => { setCustSearch(e.target.value); searchCustomers(e.target.value); }} placeholder="Search by name or phone…"/>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customers.map(c => (
                <div key={c.id} onClick={() => { setSelCustomer(c); setCustSearch(''); setCustomers([]); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selCustomer?.id===c.id?'border-primary-400 bg-primary-50':'border-slate-100 hover:border-primary-200 hover:bg-slate-50'}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{background:'linear-gradient(135deg,#3b82f6,#8b5cf6)'}}>{c.name[0]}</div>
                  <div><div className="font-semibold text-slate-800 text-sm">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></div>
                  {selCustomer?.id===c.id && <Check size={16} className="ml-auto text-primary-600"/>}
                </div>
              ))}
            </div>
            {selCustomer && (
              <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background:'linear-gradient(135deg,#3b82f6,#8b5cf6)'}}>{selCustomer.name[0]}</div>
                <div><div className="font-semibold text-primary-800 text-sm">{selCustomer.name}</div><div className="text-xs text-primary-600">{selCustomer.phone}</div></div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Select Frame */}
        {step === 1 && (
          <div>
            <h2 className="font-bold text-lg text-slate-900 mb-4">Select Frame</h2>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input className="field-input pl-9" value={frameSearch} onChange={e => { setFrameSearch(e.target.value); searchFrames(e.target.value); }} placeholder="Search brand, model…"/>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {frames.filter(f => f.stockQty > 0).map(f => (
                <div key={f.id} onClick={() => setSelFrame(f)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${selFrame?.id===f.id?'border-primary-400 bg-primary-50':'border-slate-100 hover:border-primary-200'}`}>
                  <div className="text-2xl mb-1 text-center">👓</div>
                  <div className="font-semibold text-slate-800 text-xs text-center">{f.brand}</div>
                  <div className="text-xs text-slate-500 text-center">{f.model}</div>
                  <div className="font-bold text-center text-sm mt-1">{fmt(f.sellingPrice)}</div>
                  {selFrame?.id===f.id && <div className="flex justify-center mt-1"><Check size={14} className="text-primary-600"/></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Prescription */}
        {step === 2 && (
          <div>
            <h2 className="font-bold text-lg text-slate-900 mb-4">Prescription</h2>
            {prescriptions.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button onClick={() => setUseExistingRx(true)} className={`btn-sm ${useExistingRx?'btn-primary':'btn-secondary'}`}>Use Existing</button>
                <button onClick={() => setUseExistingRx(false)} className={`btn-sm ${!useExistingRx?'btn-primary':'btn-secondary'}`}>New Rx</button>
              </div>
            )}
            {(useExistingRx && prescriptions.length > 0) ? (
              <div className="space-y-3">
                {prescriptions.map((rx,i) => (
                  <div key={rx.id} onClick={() => setSelRx(rx)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selRx?.id===rx.id?'border-primary-400 bg-primary-50':'border-slate-100 hover:border-primary-200'}`}>
                    <div className="flex justify-between mb-2 text-xs"><span className="font-semibold text-slate-700">{i===0?'Latest Rx':''} {rx.doctorName}</span>{selRx?.id===rx.id&&<Check size={14} className="text-primary-600"/>}</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div className="text-slate-500">OD: {rx.rightSph||'—'} / {rx.rightCyl||'—'} × {rx.rightAxis||'—'}</div>
                      <div className="text-slate-500">OS: {rx.leftSph||'—'} / {rx.leftCyl||'—'} × {rx.leftAxis||'—'}</div>
                      <div className="text-slate-500">PD: {rx.pd||'—'}</div>
                    </div>
                  </div>
                ))}
                <button onClick={() => { setUseExistingRx(false); setSelRx(null); }} className="btn-ghost btn-sm">+ Enter New Prescription</button>
              </div>
            ) : (
              <div>
                <div className="mb-3"><label className="field-label">Doctor Name</label><input className="field-input" value={newRx.doctorName} onChange={e=>setNewRx(f=>({...f,doctorName:e.target.value}))} placeholder="Dr. Smith"/></div>
                <table className="w-full text-sm border border-slate-100 rounded-xl overflow-hidden mb-3">
                  <thead><tr className="bg-slate-50"><th className="px-3 py-2 text-left text-xs text-slate-500">Field</th><th className="px-3 py-2 text-center text-xs text-blue-700">Right (OD)</th><th className="px-3 py-2 text-center text-xs text-emerald-700 border-l border-slate-100">Left (OS)</th></tr></thead>
                  <tbody>
                    {[['SPH','Sph'],['CYL','Cyl'],['AXIS','Axis'],['ADD','Add']].map(([l,k])=>(
                      <tr key={l} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-xs font-semibold bg-slate-50">{l}</td>
                        <td className="px-3 py-2 border-l border-slate-100"><input className="w-full text-center text-sm border border-slate-200 rounded py-1 px-1 focus:outline-none focus:ring-1 focus:ring-primary-400" type="number" step="0.25" placeholder="0.00" value={newRx[`right${k}`]} onChange={e=>setNewRx(f=>({...f,[`right${k}`]:e.target.value}))}/></td>
                        <td className="px-3 py-2 border-l border-slate-100"><input className="w-full text-center text-sm border border-slate-200 rounded py-1 px-1 focus:outline-none focus:ring-1 focus:ring-primary-400" type="number" step="0.25" placeholder="0.00" value={newRx[`left${k}`]} onChange={e=>setNewRx(f=>({...f,[`left${k}`]:e.target.value}))}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="max-w-xs"><label className="field-label">PD (mm)</label><input className="field-input" type="number" step="0.5" value={newRx.pd} onChange={e=>setNewRx(f=>({...f,pd:e.target.value}))} placeholder="63"/></div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Lens */}
        {step === 3 && (
          <div>
            <h2 className="font-bold text-lg text-slate-900 mb-4">Select Lens Package</h2>
            <button onClick={() => setSelLens(null)} className={`mb-4 btn-sm ${!selLens?'btn-primary':'btn-secondary'}`}>No Lens (Frame Only)</button>
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {lenses.map(l => (
                <div key={l.id} onClick={() => setSelLens(l)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selLens?.id===l.id?'border-primary-400 bg-primary-50':'border-slate-100 hover:border-primary-200'}`}>
                  <div className="font-semibold text-slate-800 text-sm mb-1">{l.name}</div>
                  <div className="flex flex-wrap gap-1 mb-2">{(l.coating||[]).map(c=><span key={c} className="text-xs bg-teal-50 text-teal-700 rounded-full px-1.5 py-0.5">{c}</span>)}</div>
                  <div className="font-bold text-slate-900">{fmt(l.sellingPrice)} <span className="text-xs text-slate-400 font-normal">× 2 lenses</span></div>
                  {selLens?.id===l.id && <div className="flex justify-end mt-1"><Check size={14} className="text-primary-600"/></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Checkout */}
        {step === 4 && (
          <div>
            <h2 className="font-bold text-lg text-slate-900 mb-4">Checkout</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-3">
                {/* Summary */}
                <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-slate-600">Customer</span><span className="font-semibold">{selCustomer?.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Frame</span><span className="font-semibold text-right max-w-36 truncate">{selFrame?.brand} {selFrame?.model}</span></div>
                  {selLens && <div className="flex justify-between"><span className="text-slate-600">Lens</span><span className="font-semibold text-right max-w-36 truncate">{selLens.name} ×2</span></div>}
                  <div className="border-t border-slate-200 pt-2 mt-1 space-y-1">
                    <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                    {discountAmt > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>−{fmt(discountAmt)}</span></div>}
                    {gstRate > 0 ? (
                      <div className="flex justify-between text-slate-500"><span>{`GST ${gstRate}%`}</span><span>{fmt(tax)}</span></div>
                    ) : (
                      <div className="flex justify-between text-slate-500"><span>GST</span><span>Off</span></div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-1.5 mt-1"><span>Total</span><span>{fmt(total)}</span></div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div><label className="field-label">Discount ₹</label><input className="field-input" type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></div>
                <div>
                  <label className="field-label">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['CASH','UPI','CARD'].map(m => (
                      <button key={m} onClick={() => setPayMethod(m)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${payMethod===m?'bg-primary-600 text-white border-primary-600':'bg-white text-slate-600 border-slate-200 hover:border-primary-300'}`}>
                        {m==='CASH'?'💵':m==='UPI'?'📱':'💳'} {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="field-label">Advance ₹</label><input className="field-input" type="number" value={advance} onChange={e=>setAdvance(Number(e.target.value))}/></div>
                {balance > 0 && <div className="text-sm text-red-500 font-semibold">Balance due: {fmt(balance)}</div>}
                <div><label className="field-label">Delivery Date</label><input className="field-input" type="date" value={delivDate} onChange={e=>setDelivDate(e.target.value)}/></div>
                <div><label className="field-label">Notes</label><textarea className="field-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions…"/></div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
          <button onClick={() => step > 0 ? setStep(s => s-1) : navigate('/orders')} className="btn-secondary btn-md">
            <ArrowLeft size={15}/> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length-1 ? (
            <button onClick={() => setStep(s => s+1)}
              disabled={(step===0 && !selCustomer) || (step===1 && !selFrame)}
              className="btn-primary btn-md">
              Next <ArrowRight size={15}/>
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="btn-primary btn-md">
              {saving ? 'Creating…' : '✓ Create Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
