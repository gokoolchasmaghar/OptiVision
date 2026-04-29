// frontend/src/components/NotificationBell.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Package,
  TrendingDown,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';

/* ─── helpers ─────────────────────────────────────────────── */
const PRIORITY_META = {
  high:   { dot: 'bg-red-500',    label: 'Urgent'  },
  medium: { dot: 'bg-amber-400',  label: 'Info'    },
  low:    { dot: 'bg-emerald-400',label: 'FYI'     },
};

const TYPE_ICON = {
  DELIVERY:     { Icon: Package,      bg: 'bg-teal-50',   color: 'text-teal-600'  },
  ORDER_UPDATE: { Icon: Clock,        bg: 'bg-blue-50',   color: 'text-blue-600'  },
  LOW_STOCK:    { Icon: AlertTriangle,bg: 'bg-amber-50',  color: 'text-amber-600' },
  SUMMARY:      { Icon: CheckCircle2, bg: 'bg-emerald-50',color: 'text-emerald-600'},
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const POLL_MS = 60_000; // refresh every 60 s

/* ─── component ───────────────────────────────────────────── */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen]             = useState(false);
  const [notifications, setNots]    = useState([]);
  const [counts, setCounts]         = useState({});
  const [readIds, setReadIds]       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_read') || '[]')); }
    catch { return new Set(); }
  });
  const [loading, setLoading]       = useState(false);
  const [lastFetch, setLastFetch]   = useState(null);
  const panelRef = useRef(null);
  const timerRef = useRef(null);

  /* fetch -------------------------------------------------- */
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNots(res.data.data.notifications);
      setCounts(res.data.data.counts);
      setLastFetch(new Date());
    } catch {
      // silently fail — don't break the UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    timerRef.current = setInterval(() => fetchNotifications(true), POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchNotifications]);

  /* close on outside click --------------------------------- */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* read helpers ------------------------------------------- */
  const markRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('notif_read', JSON.stringify([...next]));
      return next;
    });
  };

  const markAllRead = () => {
    setReadIds(prev => {
      const next = new Set([...prev, ...notifications.map(n => n.id)]);
      localStorage.setItem('notif_read', JSON.stringify([...next]));
      return next;
    });
  };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  /* click on notification ---------------------------------- */
  const handleNotifClick = (n) => {
    markRead(n.id);
    if (n.orderId) {
      setOpen(false);
      navigate(`/orders/${n.orderId}`);
    } else if (n.type === 'LOW_STOCK') {
      setOpen(false);
      navigate('/frames');
    }
  };

  /* ─── render ─────────────────────────────────────────── */
  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-[3px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden"
          style={{ maxHeight: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">Notifications</span>
              {counts.deliveryReady > 0 && (
                <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {counts.deliveryReady} ready to deliver
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary-600 hover:text-primary-700 font-semibold px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => fetchNotifications()}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ${loading ? 'animate-spin' : ''}`}
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Summary pills */}
          {Object.keys(counts).length > 0 && (
            <div className="flex gap-2 px-4 py-2.5 border-b border-slate-50 flex-shrink-0 overflow-x-auto">
              {counts.deliveryReady > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  <Package size={11}/> {counts.deliveryReady} Pending Delivery
                </span>
              )}
              {counts.inProgress > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  <Clock size={11}/> {counts.inProgress} In Progress
                </span>
              )}
              {counts.lowStock > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  <TrendingDown size={11}/> {counts.lowStock} Low Stock
                </span>
              )}
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm gap-2">
                <RefreshCw size={14} className="animate-spin"/> Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <CheckCircle2 size={28} className="mb-2 text-emerald-400"/>
                <span className="text-sm font-medium">All clear!</span>
                <span className="text-xs mt-0.5">No pending tasks</span>
              </div>
            ) : (
              notifications.map(n => {
                const isRead = readIds.has(n.id);
                const meta = TYPE_ICON[n.type] || TYPE_ICON.SUMMARY;
                const { Icon, bg, color } = meta;
                const prio = PRIORITY_META[n.priority] || PRIORITY_META.low;
                const isClickable = !!n.orderId || n.type === 'LOW_STOCK';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 transition-colors group
                      ${isClickable ? 'cursor-pointer hover:bg-slate-50' : ''}
                      ${!isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon size={15} className={color}/>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-bold ${!isRead ? 'text-slate-800' : 'text-slate-600'} leading-tight`}>
                          {n.title}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className={`w-1.5 h-1.5 rounded-full ${prio.dot} ${isRead ? 'opacity-30' : ''}`}/>
                          {isClickable && (
                            <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors"/>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">{timeAgo(n.createdAt)}</span>
                    </div>

                    {/* Unread dot */}
                    {!isRead && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2"/>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 flex-shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              {lastFetch ? `Updated ${timeAgo(lastFetch)}` : 'Refreshes every minute'}
            </span>
            <button
              onClick={() => { setOpen(false); navigate('/orders'); }}
              className="text-[11px] text-primary-600 hover:text-primary-700 font-semibold"
            >
              View all orders →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}