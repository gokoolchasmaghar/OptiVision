// src/components/ui/index.jsx
import { X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null;
  const widths = { sm:'max-w-md', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl', '2xl':'max-w-5xl' };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-backdrop" onClick={onClose}/>
      <div className={`modal-box w-full ${widths[size]}`}>
        <div className="modal-head">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm p-1.5 rounded-lg">
            <X size={16}/>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, color = 'gray' }) {
  const map = { gray:'badge-gray', blue:'badge-blue', green:'badge-green', yellow:'badge-yellow', red:'badge-red', purple:'badge-purple', orange:'badge-orange', teal:'badge-teal' };
  return <span className={map[color] || 'badge-gray'}>{children}</span>;
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="animate-spin"/>;
}

export function Empty({ icon = '📭', title = 'Nothing here', desc }) {
  return (
    <div className="empty-state">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="text-base font-semibold text-slate-600">{title}</div>
      {desc && <div className="text-sm mt-1 text-slate-400">{desc}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap sm:justify-end">{action}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, sub, subColor = 'green', bg = 'blue' }) {
  const bgs = { blue:'bg-blue-50', green:'bg-emerald-50', amber:'bg-amber-50', purple:'bg-violet-50', red:'bg-red-50', teal:'bg-teal-50' };
  const fgs = { blue:'text-blue-600', green:'text-emerald-600', amber:'text-amber-600', purple:'text-violet-600', red:'text-red-600', teal:'text-teal-600' };
  return (
    <div className="stat-card">
      <div className={`w-11 h-11 rounded-2xl ${bgs[bg] || bgs.blue} ${fgs[bg] || fgs.blue} flex items-center justify-center text-xl`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {sub && <div className={subColor === 'green' ? 'stat-change-up' : 'stat-change-down'}>{sub}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative w-full ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input pl-9"
      />
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    CREATED:      { label: 'Created',      color: 'gray' },
    LENS_ORDERED: { label: 'Lens Ordered', color: 'blue' },
    GRINDING:     { label: 'Grinding',     color: 'yellow' },
    FITTING:      { label: 'Fitting',      color: 'orange' },
    READY:        { label: 'Ready! 🎉',    color: 'teal' },
    DELIVERED:    { label: 'Delivered',    color: 'green' },
    CANCELLED:    { label: 'Cancelled',    color: 'red' },
    PENDING:      { label: 'Pending',      color: 'yellow' },
    PARTIAL:      { label: 'Partial',      color: 'orange' },
    PAID:         { label: 'Paid ✓',       color: 'green' },
  };
  const s = map[status] || { label: status, color: 'gray' };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto scrollbar-hide">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${active === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Confirm({ open, title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={<>
        <button className="btn-secondary btn-md" onClick={onCancel}>Cancel</button>
        <button className={`btn-md ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
      </>}>
      <p className="text-slate-600 text-sm">{message}</p>
    </Modal>
  );
}
