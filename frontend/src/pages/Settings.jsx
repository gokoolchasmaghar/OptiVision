import { useEffect, useState } from 'react';
import api from '../services/api';
import { PageHeader, Tabs } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const DEFAULT_STORE = {
  name: '',
  address: '',
  phone: '',
  email: '',
  gstNumber: '',
  gstEnabled: true,
  taxRate: 18,
  invoicePrefix: 'INV',
};

export default function Settings() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('store');
  const [store, setStore] = useState(DEFAULT_STORE);
  const [users, setUsers] = useState([]);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'STAFF', phone: '' });
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === 'SHOP_ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isAdmin) {
      api.get('/stores/current').then(r => setStore(s => ({ ...s, ...r.data.data }))).catch(() => {});
      api.get('/auth/users').then(r => setUsers(r.data.data)).catch(() => {});
    }
  }, [isAdmin]);

  const saveStore = async () => {
    setLoading(true);
    try {
      const { data } = await api.put('/stores/current', store);
      setStore(s => ({ ...s, ...data.data }));
      toast.success('Store settings saved');
    }
    catch { toast.error('Error saving settings'); }
    setLoading(false);
  };

  const changePw = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('Fill all fields');
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Passwords do not match');
    if (pwForm.newPassword.length < 6) return toast.error('Min 6 characters');
    setLoading(true);
    try { await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }); toast.success('Password changed'); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setLoading(false);
  };

  const addUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) return toast.error('Fill required fields');
    setLoading(true);
    try { await api.post('/auth/users', userForm); toast.success('User added'); setUserForm({ name: '', email: '', password: '', role: 'STAFF', phone: '' }); api.get('/auth/users').then(r => setUsers(r.data.data)); }
    catch (e) { toast.error(e.response?.data?.message || 'Error'); }
    setLoading(false);
  };

  const toggleUser = async (id, isActive) => {
    try { await api.patch(`/auth/users/${id}`, { isActive: !isActive }); api.get('/auth/users').then(r => setUsers(r.data.data)); toast.success(isActive ? 'User disabled' : 'User enabled'); }
    catch { toast.error('Error'); }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Store configuration and user management" />
      <Tabs tabs={[
        { id: 'store', label: '🏪 Store' },
        ...(isAdmin ? [{ id: 'users', label: '👥 Users' }] : []),
        { id: 'password', label: '🔐 Password' },
      ]} active={tab} onChange={setTab} />

      <div className="mt-5 max-w-2xl">
        {tab === 'store' && isAdmin && (
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-slate-800">Store Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-800">GST on new orders</div>
                  <div className="text-sm text-slate-500">Turn GST calculation on or off. Your saved GST rate stays available even when GST is off.</div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer flex-shrink-0">
                  <input
                    className="h-4 w-4 accent-primary-600"
                    type="checkbox"
                    checked={store.gstEnabled !== false}
                    onChange={e => setStore(s => ({ ...s, gstEnabled: e.target.checked }))}
                  />
                  <span className="text-sm font-semibold text-slate-700">{store.gstEnabled !== false ? 'On' : 'Off'}</span>
                </label>
              </div>
              {[
                ['Store Name *', 'name', 'OptiVision'],
                ['Phone', 'phone', '+91-9876543210'],
                ['Email', 'email', 'info@store.in'],
                ['GST Number', 'gstNumber', '27AABCU9603R1ZX'],
                ['GST Rate %', 'taxRate', '18', 'number'],
                ['Invoice Prefix', 'invoicePrefix', 'INV'],
              ].map(([label, key, ph, type = 'text']) => (
                <div key={key} className={key === 'name' ? 'col-span-2' : ''}>
                  <label className="field-label">{label}</label>
                  <input className="field-input" type={type} value={store[key] ?? ''} onChange={e => setStore(s => ({ ...s, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} placeholder={ph} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="field-label">Address</label>
                <textarea className="field-textarea" rows={2} value={store.address || ''} onChange={e => setStore(s => ({ ...s, address: e.target.value }))} placeholder="Full address" />
              </div>
            </div>
            <button className="btn-primary btn-md" onClick={saveStore} disabled={loading}>{loading ? 'Saving…' : 'Save Settings'}</button>
          </div>
        )}

        {tab === 'store' && !isAdmin && (
          <div className="card p-6 text-center text-slate-400 py-16">
            <div className="text-4xl mb-3">🔒</div>
            <div className="font-semibold">Admin access required to view store settings</div>
          </div>
        )}

        {tab === 'users' && isAdmin && (
          <div className="space-y-5">
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-slate-800">Add User</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Name *</label><input className="field-input" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="field-label">Email *</label><input className="field-input" type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="field-label">Phone</label><input className="field-input" value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="field-label">Password *</label><input className="field-input" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} /></div>
                <div><label className="field-label">Role</label>
                  <select className="field-select" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="STAFF">Staff</option>
                    <option value="SHOP_ADMIN">Shop Admin</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary btn-md" onClick={addUser} disabled={loading}>{loading ? 'Adding…' : 'Add User'}</button>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100"><h3 className="font-bold text-slate-800 text-sm">Current Users</h3></div>
              <table className="tbl">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="font-semibold text-slate-800">{u.name} {u.id === user?.id && <span className="badge-blue badge text-xs ml-1">You</span>}</td>
                      <td className="text-xs text-slate-500">{u.email}</td>
                      <td><span className={`badge ${u.role === 'SHOP_ADMIN' ? 'badge-purple' : 'badge-gray'}`}>{u.role.replace('_', ' ')}</span></td>
                      <td className="text-xs text-slate-400">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                      <td><span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                      <td>
                        {u.id !== user?.id && (
                          <button onClick={() => toggleUser(u.id, u.isActive)} className={`btn-xs ${u.isActive ? 'btn-danger' : 'btn-success'}`}>
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'password' && (
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-slate-800">Change Password</h3>
            {[['Current Password', 'currentPassword'], ['New Password', 'newPassword'], ['Confirm New Password', 'confirmPassword']].map(([label, key]) => (
              <div key={key}>
                <label className="field-label">{label}</label>
                <input className="field-input" type="password" value={pwForm[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <button className="btn-primary btn-md" onClick={changePw} disabled={loading}>{loading ? 'Changing…' : 'Change Password'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
