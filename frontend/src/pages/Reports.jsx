import { useCallback, useEffect, useRef, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { PageHeader, Tabs, Spinner } from '../components/ui';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState({ sales: [], summary: {} });
  const [frames, setFrames] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [profit, setProfit] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const loadingRef = useRef(false);
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  const downloadBlob = (data, filename) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadDailyPdf = async () => {
    try {
      const res = await api.get('/reports/daily/pdf', {
        params: { date: dateTo },
        responseType: 'blob',
      });
      downloadBlob(res.data, `daily-report-${dateTo}.pdf`);
      toast.success('Daily report downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download daily report');
    }
  };

  const downloadMonthlyPdf = async () => {
    try {
      const now = new Date();
      const month = now.toISOString().slice(0, 7); // YYYY-MM

      const res = await api.get(`/reports/monthly/pdf`, {
        params: { month },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(res.data);

      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-report-${month}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('Monthly report failed');
    }
  };

  const downloadYearlyPdf = async () => {
    try {
      const year = new Date().getFullYear();

      const res = await api.get(`/reports/yearly/pdf`, {
        params: { year },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(res.data);

      const a = document.createElement('a');
      a.href = url;
      a.download = `yearly-report-${year}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('Yearly report failed');
    }
  };

  const loadData = useCallback(async ({ showLoader = true } = {}) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showLoader) setLoading(true);
    try {
      const [sRes, fRes, cRes, pRes] = await Promise.all([
        api.get('/reports/sales', { params: { from: dateFrom, to: dateTo } }),
        api.get('/reports/frames', { params: { from: dateFrom, to: dateTo } }),
        api.get('/reports/customers', { params: { from: dateFrom, to: dateTo } }),
        api.get('/reports/profit', { params: { from: dateFrom, to: dateTo } }),
      ]);
      setSales(sRes.data.data);
      setFrames(fRes.data.data);
      setCustomers(cRes.data.data);
      setProfit(pRes.data.data);
      setLastUpdated(new Date());
    } catch { }
    loadingRef.current = false;
    if (showLoader) setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { loadData({ showLoader: true }); }, [loadData]);
  useEffect(() => {
    const timer = setInterval(() => {
      loadData({ showLoader: false });
    }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  const summary = sales.summary || {};

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Business performance insights" />

      {/* Date range */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">From</label>
          <input type="date" className="field-input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">To</label>
          <input type="date" className="field-input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => { setDateFrom(format(subDays(new Date(), d), 'yyyy-MM-dd')); setDateTo(format(new Date(), 'yyyy-MM-dd')); }}
            className="btn-secondary btn-sm">Last {d}d</button>
        ))}
        <button onClick={downloadDailyPdf} className="btn-primary btn-sm">
          Today's Report
        </button>
        <span className="text-xs text-slate-500">
          Auto-refresh: 30s{lastUpdated ? ` • Updated ${format(lastUpdated, 'h:mm:ss a')}` : ''}
        </span>

      </div>

      {/* Summary cards */}
      {profit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Revenue', value: fmt(profit.totalRevenue), icon: '💰', color: 'bg-blue-50 text-blue-700' },
            { label: 'Gross Profit', value: fmt(profit.grossProfit), icon: '📈', color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Total Tax Collected', value: fmt(profit.totalTax), icon: '🏛️', color: 'bg-amber-50 text-amber-700' },
            { label: 'Discounts Given', value: fmt(profit.totalDiscounts), icon: '🏷️', color: 'bg-red-50 text-red-700' },
            { label: 'Total Orders', value: summary._count || 0, icon: '📋', color: 'bg-purple-50 text-purple-700' },
            { label: 'Avg Order Value', value: fmt(summary._avg?.totalAmount), icon: '📊', color: 'bg-teal-50 text-teal-700' },
          ].map(c => (
            <div key={c.label} className="card p-4">
              <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center text-lg mb-2`}>{c.icon}</div>
              <div className="text-xl font-bold text-slate-900">{c.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs tabs={[{ id: 'sales', label: 'Sales Trend' }, { id: 'frames', label: 'Frame Sales' }, { id: 'customers', label: 'Top Customers' }]} active={tab} onChange={setTab} />

      <div className="mt-4">
        {loading ? <div className="flex justify-center py-16"><Spinner size={28} /></div> :
          tab === 'sales' ? (
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-4">Daily Revenue</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={sales.sales} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d), 'MMM d')} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v / 1000}K`} axisLine={false} tickLine={false} width={52} />
                  <Tooltip formatter={(v, n) => [fmt(v), n]} labelFormatter={d => format(new Date(d), 'MMM d, yyyy')} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#g1)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : tab === 'frames' ? (
            <div className="card overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Brand / Model</th><th className="text-right">Units Sold</th><th className="text-right">Revenue</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead>
                <tbody>
                  {frames.slice(0, 20).map((f, i) => (
                    <tr key={i}>
                      <td><div className="font-semibold text-slate-800">{f.brand} {f.model}</div><div className="text-xs text-slate-400">{f.frameCode}</div></td>
                      <td className="text-right font-bold">{f.unitsSold}</td>
                      <td className="text-right font-semibold">{fmt(f.revenue)}</td>
                      <td className="text-right text-emerald-600 font-semibold">{fmt(f.profit)}</td>
                      <td className="text-right"><span className="badge-green badge">{f.revenue > 0 ? Math.round(f.profit / f.revenue * 100) : 0}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {frames.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No data for this period</div>}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="tbl">
                <thead><tr><th>Customer</th><th>Phone</th><th className="text-right">Orders</th><th className="text-right">Total Spent</th></tr></thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={i}>
                      <td><div className="font-semibold text-slate-800">{c.name}</div>{c.email && <div className="text-xs text-slate-400">{c.email}</div>}</td>
                      <td className="text-sm text-slate-500">{c.phone}</td>
                      <td className="text-right font-bold">{c.totalOrders}</td>
                      <td className="text-right font-semibold text-primary-600">{fmt(c.totalSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="card p-5 space-y-4 mt-6">

        <h3 className="font-bold text-lg text-slate-800">Reports</h3>

        {/* Daily */}
        <button
          onClick={downloadDailyPdf}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          📄 Download Today's Report
        </button>

        {/* Monthly */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
          <div>
            <div className="font-semibold text-slate-800">This Month</div>
            <div className="text-xs text-slate-500">1st → Today</div>
          </div>

          <button
            onClick={downloadMonthlyPdf}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition"
          >
            Download
          </button>
        </div>

        {/* Yearly */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
          <div>
            <div className="font-semibold text-slate-800">This Year</div>
            <div className="text-xs text-slate-500">Jan → Today</div>
          </div>

          <button
            onClick={downloadYearlyPdf}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
