import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>👁</div>
          <div>
            <div className="font-bold text-white text-lg">GO-KOOL CHASMAGHAR</div>
            <div className="text-xs text-slate-500">Optical Shop Management Suite</div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Professional<br/>
            <span style={{ background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Optical Store
            </span><br/>
            Management
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Manage frames, lenses, prescriptions, billing and inventory — all in one place.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {['👥 Customer CRM','🧾 GST Billing','📦 Inventory','📊 Analytics'].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 rounded-xl px-3 py-2">
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600">© 2025 GO-KOOL CHASMAGHAR. All rights reserved.</div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>👁</div>
            <span className="font-bold text-white text-xl">GO-KOOL CHASMAGHAR</span>
          </div>

          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
            <p className="text-slate-400 text-sm mb-8">Welcome back to GO-KOOL CHASMAGHAR</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Email</label>
                <input
                  type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {err && (
                <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{err}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: loading ? '#1d4ed8' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 8px 20px rgba(37,99,235,.35)' }}>
                {loading ? <><Loader2 size={15} className="animate-spin"/> Signing in…</> : 'Sign In →'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
