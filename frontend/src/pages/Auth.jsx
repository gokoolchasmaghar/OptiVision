import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Auth() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState('');

  // Sign In form
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });

  // Sign Up form
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  // Handle Sign In
  const handleSignIn = async e => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(signinForm.email, signinForm.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up
  const handleSignUp = async e => {
    e.preventDefault();
    setErr('');

    // Validation
    if (!signupForm.name.trim()) {
      setErr('Name is required');
      return;
    }
    if (!signupForm.email.trim()) {
      setErr('Email is required');
      return;
    }
    if (signupForm.password.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      setErr('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/signup', {
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password
      });

      if (response.data.success) {
        toast.success('Account created! Please sign in.');
        setMode('signin');
        setSigninForm({ email: signupForm.email, password: '' });
        setSignupForm({ name: '', email: '', password: '', confirmPassword: '' });
      }
    } catch (e) {
      const message = e.response?.data?.message || 'Sign up failed. Please try again.';
      setErr(message);
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
            <div className="font-bold text-white text-lg">OptiVision</div>
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

        <div className="text-xs text-slate-600">© 2025 OptiVision. All rights reserved.</div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>👁</div>
            <span className="font-bold text-white text-xl">OptiVision</span>
          </div>

          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => { setMode('signin'); setErr(''); }}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
                  mode === 'signin'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                style={mode === 'signin' ? { background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' } : {}}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setErr(''); }}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
                  mode === 'signup'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                style={mode === 'signup' ? { background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' } : {}}
              >
                Sign Up
              </button>
            </div>

            {/* Sign In Form */}
            {mode === 'signin' && (
              <>
                <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
                <p className="text-slate-400 text-sm mb-8">Welcome back to OptiVision</p>

                <form onSubmit={handleSignIn} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={signinForm.email}
                      onChange={e => setSigninForm(f => ({...f, email: e.target.value}))}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                      placeholder="name@company.com"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={signinForm.password}
                        onChange={e => setSigninForm(f => ({...f, password: e.target.value}))}
                        className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                        placeholder="••••••••"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>

                  {err && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{err}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: loading ? '#1d4ed8' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 8px 20px rgba(37,99,235,.35)' }}
                  >
                    {loading ? <><Loader2 size={15} className="animate-spin"/> Signing in…</> : 'Sign In →'}
                  </button>
                </form>
              </>
            )}

            {/* Sign Up Form */}
            {mode === 'signup' && (
              <>
                <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
                <p className="text-slate-400 text-sm mb-8">Join OptiVision and manage your optical store</p>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                    <input
                      type="text"
                      required
                      value={signupForm.name}
                      onChange={e => setSignupForm(f => ({...f, name: e.target.value}))}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                      placeholder="John Doe"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={signupForm.email}
                      onChange={e => setSignupForm(f => ({...f, email: e.target.value}))}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                      placeholder="name@company.com"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={signupForm.password}
                        onChange={e => setSignupForm(f => ({...f, password: e.target.value}))}
                        className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                        placeholder="••••••••"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        required
                        value={signupForm.confirmPassword}
                        onChange={e => setSignupForm(f => ({...f, confirmPassword: e.target.value}))}
                        className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                        placeholder="••••••••"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>

                  {err && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{err}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-6"
                    style={{ background: loading ? '#1d4ed8' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 8px 20px rgba(37,99,235,.35)' }}
                  >
                    {loading ? <><Loader2 size={15} className="animate-spin"/> Creating account…</> : 'Sign Up →'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
