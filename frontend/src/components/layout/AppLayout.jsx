import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Glasses, Eye, ClipboardList,
  Receipt, Package, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, Bell, Plus
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const NAV = [
  { to:'/dashboard', icon:LayoutDashboard, label:'Dashboard' },
  { to:'/customers',  icon:Users,          label:'Customers' },
  { to:'/frames',     icon:Glasses,        label:'Frames' },
  { to:'/lenses',     icon:Eye,            label:'Lenses' },
  { to:'/orders',     icon:ClipboardList,  label:'Orders' },
  { to:'/billing',    icon:Receipt,        label:'Billing' },
  { to:'/inventory',  icon:Package,        label:'Inventory' },
  { to:'/reports',    icon:BarChart3,      label:'Reports' },
  { to:'/settings',   icon:Settings,       label:'Settings' },
];

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mini, setMini] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Sidebar ── */}
      <aside className={`flex flex-col h-full flex-shrink-0 transition-all duration-300 ${mini ? 'w-[64px]' : 'w-[220px]'}`}
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}>

        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-white/8 ${mini ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
            <span>👁</span>
          </div>
          {!mini && (
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm leading-none">OptiVision</div>
              <div className="text-xs text-slate-500 mt-0.5">Management Suite</div>
            </div>
          )}
          <button onClick={() => setMini(!mini)}
            className="flex-shrink-0 p-1 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-colors">
            {mini ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-hide">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-active' : 'nav-inactive'} ${mini ? 'justify-center px-2' : ''}`
              }
              title={mini ? label : undefined}>
              <Icon size={17} className="flex-shrink-0"/>
              {!mini && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Quick action */}
        {!mini && (
          <div className="px-3 py-2">
            <button onClick={() => navigate('/orders/new')}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white/80 border border-white/10 hover:bg-white/10 hover:text-white transition-all">
              <Plus size={13}/> New Order
            </button>
          </div>
        )}

        {/* User */}
        <div className="p-2 border-t border-white/8">
          {!mini ? (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {user?.name?.[0]}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
                <div className="text-xs text-slate-500">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {user?.name?.[0]}
              </div>
            </div>
          )}
          <button onClick={() => { logout(); toast.success('Signed out'); navigate('/login'); }}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${mini ? 'justify-center' : ''}`}>
            <LogOut size={14}/>
            {!mini && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1"/>
          <button className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors relative">
            <Bell size={17}/>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500"/>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              {user?.name?.[0]}
            </div>
            <div className="text-sm">
              <span className="text-slate-500">Hi, </span>
              <span className="font-semibold text-slate-800">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          <div className="max-w-screen-2xl mx-auto">
            <Outlet/>
          </div>
        </main>
      </div>
    </div>
  );
}
