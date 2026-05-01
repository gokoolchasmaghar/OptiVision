import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Package, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { PageHeader, StatusBadge, Spinner } from '../components/ui';
import NotificationBell from '../components/NotificationBell';
import { format } from 'date-fns';

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const fmtK = n => n >= 1000 ? `₹${(n/1000).toFixed(1)}K` : fmt(n);

const ORDER_STATUS_COLORS = {
  CREATED:'#94a3b8', LENS_ORDERED:'#3b82f6', GRINDING:'#f59e0b',
  FITTING:'#f97316', READY:'#14b8a6', DELIVERED:'#22c55e', CANCELLED:'#ef4444'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32}/></div>;
  if (!data) return <div className="text-center text-slate-400 py-16">Failed to load dashboard</div>;

  const { stats, weekSales = [], topFrames = [], lowStock = [], recentOrders = [], ordersByStatus = {}, paymentBreakdown = [] } = data;

  const pieData = Object.entries(ordersByStatus).map(([k,v]) => ({ name: k.replace('_',' '), value: v, fill: ORDER_STATUS_COLORS[k] || '#94a3b8' }));
  const payPie = paymentBreakdown.map((p,i) => ({ name: p.method, value: p.total, fill: ['#3b82f6','#10b981','#f59e0b'][i] }));

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Today · {format(new Date(), 'EEEE, MMM d yyyy')}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon:'💰', label:"Today's Revenue", value: fmt(stats.todayRevenue), sub: `${stats.todayOrders} orders today`, bg:'blue' },
          { icon:'⏳', label:'Pending Orders', value: stats.pendingOrders, sub: 'Need attention', bg:'amber' },
          { icon:'👥', label:'Total Customers', value: stats.totalCustomers, sub: 'All time', bg:'purple' },
          { icon:'📈', label:'Month Revenue', value: fmtK(stats.monthRevenue), sub: stats.growth >= 0 ? `↑ ${stats.growth}% vs last month` : `↓ ${Math.abs(stats.growth)}% vs last month`, subColor: stats.growth >= 0 ? 'green' : 'red', bg:'teal' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-2 ${
              s.bg==='blue'?'bg-blue-50':s.bg==='amber'?'bg-amber-50':s.bg==='purple'?'bg-violet-50':'bg-teal-50'}`}>
              {s.icon}
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            {s.sub && <div className={s.subColor === 'red' ? 'stat-change-down' : 'stat-change-up'}>
              {s.subColor === 'red' ? <TrendingDown size={11}/> : <TrendingUp size={11}/>} {s.sub}
            </div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Weekly Sales Area Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">7-Day Revenue</h3>
            <span className="badge-gray badge text-xs">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weekSales} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize:11, fill:'#94a3b8' }} tickFormatter={d => format(new Date(d),'EEE')} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} tickFormatter={v => `₹${v/1000}K`} axisLine={false} tickLine={false} width={48}/>
              <Tooltip formatter={v => [fmt(v), 'Revenue']} labelFormatter={d => format(new Date(d),'MMM d')} contentStyle={{ borderRadius:10, border:'1px solid #e2e8f0', fontSize:12 }}/>
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill:'#3b82f6', strokeWidth:0, r:3 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">Orders by Status</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius:10, fontSize:12 }}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.fill }}/>
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-slate-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Frames */}
        <div className="card p-5">
          <h3 className="font-bold text-slate-800 mb-4">Top Frames (30d)</h3>
          {topFrames.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">No sales data</div>
          ) : (
            <div className="space-y-3">
              {topFrames.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{f.brand} {f.model}</div>
                    <div className="text-xs text-slate-400">{f.unitsSold} sold</div>
                  </div>
                  <div className="text-sm font-bold text-slate-700">{fmtK(f.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Low Stock Alert</h3>
            {lowStock.length > 0 && <span className="badge-red badge">{lowStock.length}</span>}
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm text-slate-500">All stocked up!</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStock.map(f => (
                <div key={f.id} className="flex items-center gap-3">
                  <AlertTriangle size={14} className={f.stockQty === 0 ? 'text-red-500' : 'text-amber-500'}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{f.brand} {f.model}</div>
                    <div className="text-xs text-slate-400">{f.frameCode}</div>
                  </div>
                  <span className={`badge ${f.stockQty === 0 ? 'badge-red' : 'badge-yellow'}`}>{f.stockQty === 0 ? 'OOS' : f.stockQty}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Recent Orders</h3>
            <button onClick={() => navigate('/orders')} className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1">
              View all <ExternalLink size={11}/>
            </button>
          </div>
          <div className="space-y-2.5">
            {recentOrders.map(o => (
              <div key={o.id} onClick={() => navigate(`/orders/${o.id}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-xs flex-shrink-0">
                  {o.customer?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{o.customer?.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{o.orderNumber}</div>
                </div>
                <StatusBadge status={o.status}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}