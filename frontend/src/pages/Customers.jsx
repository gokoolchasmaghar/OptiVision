import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Phone, Mail, MapPin, Eye } from 'lucide-react';
import api from '../services/api';
import { Modal, PageHeader, SearchInput, Spinner, Empty } from '../components/ui';
import toast from 'react-hot-toast';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', gender:'', age:'' });
  const [saving, setSaving] = useState(false);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const r = await api.get('/customers', { params: { search: q, limit: 50 } });
      setCustomers(r.data.data);
    } catch (e) { toast.error('Failed to load customers'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const save = async () => {
    if (!form.name || !form.phone) return toast.error('Name and phone required');
    setSaving(true);
    try {
      await api.post('/customers', form);
      toast.success('Customer added');
      setShowModal(false);
      setForm({ name:'', phone:'', email:'', address:'', gender:'', age:'' });
      load(search);
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} records`}
        action={<button className="btn-primary btn-md" onClick={() => setShowModal(true)}><Plus size={15}/> Add Customer</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone, email…" className="sm:flex-1 sm:max-w-sm"/>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28}/></div>
      ) : customers.length === 0 ? (
        <div className="card"><Empty icon="👥" title="No customers found" desc="Add your first customer to get started"/></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {customers.map(c => (
            <div key={c.id} className="card card-hover p-5 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                  {c.name[0]}
                </div>
                <div className="flex items-center gap-2">
                  {c._count?.prescriptions > 0 && <span className="badge-blue badge">👁 Rx</span>}
                </div>
              </div>
              <div className="font-bold text-slate-900 text-sm mb-1 truncate">{c.name}</div>
              {c.gender && c.age && <div className="text-xs text-slate-500 mb-2">{c.gender} · {c.age} yrs</div>}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                  <Phone size={11} className="flex-shrink-0"/> {c.phone}
                </div>
                {c.email && <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate"><Mail size={11} className="flex-shrink-0"/> {c.email}</div>}
                {c.address && <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate"><MapPin size={11} className="flex-shrink-0"/> {c.address}</div>}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                <span>📋 {c._count?.orders || 0} orders</span>
                <button className="text-primary-600 font-semibold flex items-center gap-1" onClick={e => {e.stopPropagation(); navigate(`/customers/${c.id}`);}}>
                  View <Eye size={11}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Customer"
        footer={<>
          <button className="btn-secondary btn-md" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary btn-md" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Customer'}</button>
        </>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="field-label">Full Name *</label>
            <input className="field-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Rajesh Kumar"/>
          </div>
          <div>
            <label className="field-label">Phone *</label>
            <input className="field-input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+91-9876543210"/>
          </div>
          <div>
            <label className="field-label">Email</label>
            <input className="field-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="email@example.com"/>
          </div>
          <div>
            <label className="field-label">Gender</label>
            <select className="field-select" value={form.gender} onChange={e => setForm(f => ({...f, gender: e.target.value}))}>
              <option value="">Select</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="field-label">Age</label>
            <input className="field-input" type="number" value={form.age} onChange={e => setForm(f => ({...f, age: e.target.value}))} placeholder="30" min="1" max="120"/>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Address</label>
            <input className="field-input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City, State"/>
          </div>
        </div>
      </Modal>
    </div>
  );
}
