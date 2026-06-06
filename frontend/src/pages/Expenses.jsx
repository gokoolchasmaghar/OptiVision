import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Search, 
  Home, 
  Zap, 
  Coffee, 
  Truck, 
  Wrench, 
  Wifi, 
  Paperclip, 
  MoreHorizontal, 
  Wallet, 
  FileText, 
  TrendingUp, 
  Award,
  Download,
  BarChart3,
  Calendar,
  Filter,
  ArrowLeft,
  UploadCloud,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = [
  { value: 'RENT', label: 'Rent', color: '#3b82f6', bg: 'bg-blue-50 text-blue-600 border-blue-200', icon: Home },
  { value: 'ELECTRICITY', label: 'Electricity', color: '#10b981', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: Zap },
  { value: 'TEA_SNACKS', label: 'Tea & Snacks', color: '#f59e0b', bg: 'bg-amber-50 text-amber-600 border-amber-200', icon: Coffee },
  { value: 'TRANSPORT', label: 'Transport', color: '#8b5cf6', bg: 'bg-purple-50 text-purple-600 border-purple-200', icon: Truck },
  { value: 'STATIONERY', label: 'Stationery', color: '#ec4899', bg: 'bg-pink-50 text-pink-600 border-pink-200', icon: Paperclip },
  { value: 'INTERNET', label: 'Phone / Internet', color: '#06b6d4', bg: 'bg-cyan-50 text-cyan-600 border-cyan-200', icon: Wifi },
  { value: 'MAINTENANCE', label: 'Maintenance', color: '#b45309', bg: 'bg-orange-50 text-orange-700 border-orange-200', icon: Wrench },
  { value: 'OTHER', label: 'Other', color: '#14b8a6', bg: 'bg-teal-50 text-teal-600 border-teal-200', icon: MoreHorizontal },
];

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'UPI', label: 'UPI', bg: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'CARD', label: 'Card', bg: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', bg: 'bg-blue-50 text-blue-600 border-blue-200' },
];

const getLocalDatetime = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function Expenses() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({ totalExpenses: 0, expenseCount: 0, highestExpense: null });
  const [categorySummary, setCategorySummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const limit = 10;

  // Layout View States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // MODAL STATE - Crucial for the popup to work!
  const [viewingExpense, setViewingExpense] = useState(null);

  // Form State
  const [form, setForm] = useState({
    category: '',
    customCategoryName: '',
    description: '',
    amount: '',
    paymentMode: '',
    paidBy: '',
    notes: '',
    receiptUrl: '',
    createdAt: getLocalDatetime()
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    paymentMode: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters(current => ({ ...current, [key]: value }));
  };

  const handleSort = (sortBy) => {
    setPage(1);
    setSort(current => ({
      sortBy,
      sortOrder: current.sortBy === sortBy && current.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  const reportParams = useMemo(() => ({
    ...(filters.category && { category: filters.category }),
    ...(filters.paymentMode && { paymentMode: filters.paymentMode }),
    ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
    ...(filters.dateTo && { dateTo: filters.dateTo }),
    ...(filters.search.trim() && { search: filters.search.trim() }),
  }), [filters]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...reportParams,
        ...sort,
        page,
        limit,
      };

      const res = await api.get('/expenses', { params });
      
      setExpenses(res.data.data || []);
      setTotal(res.data.pagination?.total || (res.data.data || []).length);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [page, reportParams, sort]);

  const loadStats = useCallback(async () => {
    try {
      const [summaryRes, categoryRes] = await Promise.all([
        api.get('/expenses/stats/summary', { params: reportParams }),
        api.get('/expenses/summary/by-category', { params: reportParams }),
      ]);
      const res = summaryRes;
      setStats(res.data.data);
      setCategorySummary(categoryRes.data.data || []);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }, [reportParams]);

  useEffect(() => {
    loadExpenses();
    loadStats();
  }, [loadExpenses, loadStats]);

  const handleSubmit = async e => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.category || !form.description.trim() || !form.amount || !form.paymentMode || !form.createdAt) {
      return toast.error('Please complete all mandatory field indicators (*)');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error('Amount must be greater than 0');
    }
    if (form.category === 'OTHER' && !form.customCategoryName.trim()) {
      return toast.error('Please specify the custom category name');
    }

    const payload = {
      ...form,
      customCategoryName: form.category === 'OTHER' ? form.customCategoryName.trim() : '',
      description: form.description.trim(),
      amount,
      createdAt: new Date(form.createdAt).toISOString()
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
        toast.success('Expense record updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense record logged');
        setPage(1);
      }
      
      handleCancel();
      await Promise.all([loadExpenses(), loadStats()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = expense => {
    setForm({
      category: expense.category,
      customCategoryName: expense.customCategoryName || '',
      description: expense.description,
      amount: String(expense.amount),
      paymentMode: expense.paymentMode,
      paidBy: expense.paidBy || '',
      notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || '',
      createdAt: getLocalDatetime(expense.createdAt)
    });
    setEditingId(expense.id);
    setIsEditingMode(true);
    setViewingExpense(null); // Closes modal when edit opens
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevents the row click event from firing the modal
    if (!window.confirm('Remove selected row permanently?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Entry removed');
      setViewingExpense(null); 
      await Promise.all([loadExpenses(), loadStats()]);
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const handleCancel = () => {
    setIsEditingMode(false);
    setEditingId(null);
    setForm({ 
      category: '', customCategoryName: '', description: '', amount: '', 
      paymentMode: '', paidBy: '', notes: '', receiptUrl: '', createdAt: getLocalDatetime() 
    });
  };

  const handleFileUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const data = new FormData();
      data.append('type', 'expenses');
      data.append('file', file);
      try {
        const res = await api.post('/upload', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setForm(current => ({ ...current, receiptUrl: res.data.url }));
        toast.success(`Receipt uploaded: ${file.name}`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to upload receipt');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/expenses/export.csv', {
        params: reportParams,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Expenses exported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export expenses');
    }
  };

  const getCategoryMeta = (expenseOrString) => {
    const isObject = typeof expenseOrString === 'object';
    const catValue = isObject ? expenseOrString.category : expenseOrString;
    
    if (catValue === 'OTHER' && isObject && expenseOrString.customCategoryName) {
      return { label: expenseOrString.customCategoryName, color: '#14b8a6', bg: 'bg-teal-50 text-teal-600 border-teal-100', icon: MoreHorizontal };
    }
    return CATEGORIES.find(c => c.value === catValue) || { label: catValue, color: '#64748b', bg: 'bg-slate-50 text-slate-600', icon: MoreHorizontal };
  };

  const getPaymentModeBadge = (modeVal) => {
    return PAYMENT_MODES.find(m => m.value === modeVal) || { label: modeVal, bg: 'bg-slate-50 text-slate-600' };
  };

  const safeTotalExpenses = categorySummary.reduce((sum, item) => sum + Number(item.total || 0), 0) || 1;
  const donutData = categorySummary.map(item => {
    const meta = getCategoryMeta({ category: item.category, customCategoryName: item.customCategoryName });
    const amount = Number(item.total || 0);
    return {
      category: item.category,
      label: item.label || meta.label,
      amount,
      percentage: (amount / safeTotalExpenses) * 100,
      color: meta.color
    };
  }).sort((a, b) => b.amount - a.amount);
  
  const radius = 55;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;


  // ==========================================
  // VIEW DETAILS MODAL HELPER
  // ==========================================
  const renderDetailsModal = () => {
    if (!viewingExpense) return null;
    const catMeta = getCategoryMeta(viewingExpense);
    const CatIcon = catMeta.icon;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
          
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Eye size={18} className="text-slate-500" /> Expense Details
            </h3>
            <button 
              onClick={() => setViewingExpense(null)}
              className="text-slate-400 hover:text-slate-700 bg-white p-1 rounded-md border border-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
                <div className="text-3xl font-black text-slate-900">{fmt(viewingExpense.amount)}</div>
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase mt-1 border ${getPaymentModeBadge(viewingExpense.paymentMode).bg}`}>
                  Paid via {getPaymentModeBadge(viewingExpense.paymentMode).label}
                </span>
              </div>
              
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <span className="text-sm font-bold text-slate-800">{catMeta.label}</span>
                  <div className={`p-1.5 rounded-lg border ${catMeta.bg}`}>
                    <CatIcon size={14} />
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(viewingExpense.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <br/>
                  {new Date(viewingExpense.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-1 gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                <p className="text-sm font-semibold text-slate-800 leading-snug">{viewingExpense.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Paid By</span>
                  <p className="text-sm font-medium text-slate-700">{viewingExpense.paidBy || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Logged By</span>
                  <p className="text-sm font-medium text-slate-700">{viewingExpense.creator?.name || 'System'}</p>
                </div>
              </div>

              {viewingExpense.notes && (
                <div className="pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Additional Notes</span>
                  <p className="text-xs font-medium text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">{viewingExpense.notes}</p>
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Attached Receipt</span>
              {viewingExpense.receiptUrl ? (
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white group hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                      <Paperclip size={16} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 truncate">{viewingExpense.receiptUrl.split('/').pop()}</span>
                  </div>
                  
                  <a 
                    href={viewingExpense.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                  >
                    View File <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400">
                  <UploadCloud size={24} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">No receipt attached to this record</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button 
              onClick={(e) => handleDelete(e, viewingExpense.id)}
              className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
            >
              Delete Record
            </button>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setViewingExpense(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => handleEdit(viewingExpense)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Edit2 size={14} /> Edit Expense
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ==========================================
  // VIEW 1: DEDICATED ADD/EDIT FORM SCREEN
  // ==========================================
  if (isEditingMode) {
    return (
      <div className="max-w-7xl mx-auto p-4 bg-[#f8fafc] min-h-screen space-y-6 animate-fadeIn relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <button 
              onClick={handleCancel}
              className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors gap-1.5 mb-1"
            >
              <ArrowLeft size={15} /> Back to Daily Expenses
            </button>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {editingId ? 'Edit Expense' : 'Add Expense'}
            </h1>
            <p className="text-xs text-slate-500">Record a new business expense transaction</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium shadow-sm flex items-center shrink-0">
            <Calendar size={15} className="mr-2 text-slate-400" />
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">Expense Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category <span className="text-red-500">*</span></label>
                <select
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description <span className="text-red-500">*</span></label>
                <input
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Enter expense description"
                  required
                />
              </div>
            </div>

            {form.category === 'OTHER' && (
              <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-xl animate-fadeIn">
                <label className="block text-xs font-bold text-teal-700 uppercase mb-1">Specify Custom Category Title *</label>
                <input
                  className="w-full p-2 bg-white border border-teal-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={form.customCategoryName}
                  onChange={e => setForm({ ...form, customCategoryName: e.target.value })}
                  placeholder="e.g., Office Renovations, Packaging Material"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Mode <span className="text-red-500">*</span></label>
                <select
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.paymentMode}
                  onChange={e => setForm({ ...form, paymentMode: e.target.value })}
                  required
                >
                  <option value="">Select Payment Mode</option>
                  {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date & Time <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.createdAt}
                  onChange={e => setForm({ ...form, createdAt: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Paid By</label>
                <input
                  type="text"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={form.paidBy}
                  onChange={e => setForm({ ...form, paidBy: e.target.value })}
                  placeholder="Enter person's name (Optional)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Receipt / Bill (Optional)</label>
                <label className="flex flex-col items-center justify-center w-full h-[46px] border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition-all cursor-pointer relative overflow-hidden">
                  <div className="flex items-center gap-2 text-slate-500 px-4">
                    <UploadCloud size={16} className="text-blue-500 shrink-0" />
                    <span className="text-xs font-semibold text-blue-600 truncate max-w-[240px]">
                      {form.receiptUrl ? form.receiptUrl.split('/').pop() : 'Upload Receipt'}
                    </span>
                  </div>
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes (Optional)</label>
              <textarea
                rows="3"
                className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700 text-xs"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Add any additional notes here..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow transition-all"
              >
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>

          {/* Right Column Interactive Grids */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Expense Category</h4>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(c => {
                  const CatIcon = c.icon;
                  const isSelected = form.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: c.value })}
                      className={`flex items-center gap-2.5 p-3 rounded-xl text-left border transition-all ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/70 text-blue-700 font-bold shadow-xs' 
                          : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg border bg-white">
                        <CatIcon size={14} className={isSelected ? 'text-blue-600' : 'text-slate-500'} />
                      </div>
                      <span className="text-xs truncate">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Mode</h4>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_MODES.map(m => {
                  const isSelected = form.paymentMode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm({ ...form, paymentMode: m.value })}
                      className={`p-3 rounded-xl border text-left font-semibold text-xs flex items-center gap-2 transition-all ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/70 text-blue-700 font-bold' 
                          : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Today's Summary</h4>
              <div className="flex justify-between py-1.5 text-xs font-medium text-slate-600 border-b border-slate-50">
                <span>Total Expenses</span>
                <span className="font-bold text-slate-900">{fmt(stats.totalExpenses)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-xs font-medium text-slate-600">
                <span>No. of Expenses</span>
                <span className="font-bold text-slate-900">{stats.expenseCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Recent Expenses</h4>
            <button type="button" onClick={handleCancel} className="text-xs font-bold text-blue-600 hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                  <th className="p-3">#</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-center">Payment Mode</th>
                  <th className="p-3">Time</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {expenses.slice(0, 3).map((exp, i) => {
                  const meta = getCategoryMeta(exp);
                  return (
                    <tr 
                      key={exp.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      onClick={() => setViewingExpense(exp)}
                    >
                      <td className="p-3 text-slate-400">{i + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{exp.description}</td>
                      <td className="p-3">
                        <span className="text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-semibold">
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">{fmt(exp.amount)}</td>
                      <td className="p-3 text-center">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                          {getPaymentModeBadge(exp.paymentMode).label}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(exp.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(exp); }} 
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, exp.id)} 
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Render Modal if applicable */}
        {renderDetailsModal()}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ORIGINAL MAIN DASHBOARD VIEW
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 bg-slate-50/50 min-h-screen relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record and manage daily business expenses</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm flex items-center">
            <Calendar size={15} className="mr-2 text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent border-none text-slate-700 text-sm focus:outline-none"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
            />
          </div>

          <button 
            onClick={() => setIsEditingMode(true)}
            className="inline-flex items-center gap-2 bg-[#2563eb] hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Expenses</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : fmt(stats.totalExpenses)}
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-inner"><Wallet size={20} /></div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">No. of Expenses</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : stats.expenseCount}
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-inner"><FileText size={20} /></div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Average Expense</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : fmt(stats.expenseCount > 0 ? stats.totalExpenses / stats.expenseCount : 0)}
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-inner"><TrendingUp size={20} /></div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Highest Expense</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : (stats.highestExpense ? fmt(stats.highestExpense.amount) : '—')}
            </div>
            {stats.highestExpense && <span className="text-xs text-slate-400 block truncate max-w-[140px]">{stats.highestExpense.description}</span>}
          </div>
          <div className="h-11 w-11 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-inner"><Award size={20} /></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">Expenses List</h3>
                <span className="bg-slate-200 text-slate-700 font-medium text-xs px-2 py-0.5 rounded-full">{total} items</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-60">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg border text-sm flex items-center gap-1.5 transition-all ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600 font-medium' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  <Filter size={15} /><span className="hidden sm:inline">Filters</span>
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:outline-none"
                  value={filters.category}
                  onChange={e => updateFilter('category', e.target.value)}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>

                <select
                  className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:outline-none"
                  value={filters.paymentMode}
                  onChange={e => updateFilter('paymentMode', e.target.value)}
                >
                  <option value="">All Payment Modes</option>
                  {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>

                <input
                  type="date"
                  className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:outline-none"
                  value={filters.dateTo}
                  onChange={e => updateFilter('dateTo', e.target.value)}
                />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs uppercase bg-slate-50/70">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">
                      <button type="button" onClick={() => handleSort('category')} className="font-semibold uppercase">Category</button>
                    </th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">
                      <button type="button" onClick={() => handleSort('amount')} className="font-semibold uppercase">Amount</button>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <button type="button" onClick={() => handleSort('paymentMode')} className="font-semibold uppercase">Payment Mode</button>
                    </th>
                    <th className="py-3 px-4">
                      <button type="button" onClick={() => handleSort('createdAt')} className="font-semibold uppercase">Date & Time</button>
                    </th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {loading ? (
                    <tr><td colSpan="7" className="py-8 text-center text-slate-400">Loading metrics...</td></tr>
                  ) : expenses.length === 0 ? (
                    <tr><td colSpan="7" className="py-8 text-center text-slate-400">No expense records found.</td></tr>
                  ) : (
                    expenses.map((exp, idx) => {
                      const meta = getCategoryMeta(exp);
                      const Icon = meta.icon;
                      const payMeta = getPaymentModeBadge(exp.paymentMode);
                      return (
                        <tr 
                          key={exp.id} 
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                          onClick={() => setViewingExpense(exp)}
                        >
                          <td className="py-3.5 px-4 text-center text-slate-400 font-medium">{(page - 1) * limit + idx + 1}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md ${meta.bg} border`}><Icon size={14} /></div>
                              <span className="truncate max-w-[110px]" title={meta.label}>{meta.label}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 truncate max-w-[160px]" title={exp.description}>{exp.description}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">{fmt(exp.amount)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${payMeta.bg}`}>
                              {payMeta.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-xs">
                            <div className="font-medium">{new Date(exp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            <div className="text-slate-400 mt-0.5">{new Date(exp.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(exp); }} 
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={(e) => handleDelete(e, exp.id)} 
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {total > limit && (
              <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Showing <span className="font-semibold text-slate-800">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-semibold text-slate-800">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-semibold text-slate-800">{total}</span> expenses
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-slate-600 font-medium">Page {page} of {Math.ceil(total / limit)}</span>
                  <button
                    disabled={page >= Math.ceil(total / limit)}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Expense by Category</h3>
            
            <div className="flex flex-col items-center justify-center relative">
              <div className="relative h-40 w-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r={radius} fill="transparent" stroke="#f8fafc" strokeWidth={strokeWidth} />
                  {donutData.map((slice, i) => {
                    const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = circumference - (accumulatedOffset / 100) * circumference;
                    accumulatedOffset += slice.percentage;
                    return (
                      <circle
                        key={i} cx="70" cy="70" r={radius} fill="transparent" stroke={slice.color}
                        strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round" className="transition-all duration-300"
                      />
                    );
                  })}
                </svg>
                <div className="absolute text-center flex flex-col justify-center items-center">
                  <span className="text-lg font-black text-slate-800">₹{Math.round(stats.totalExpenses).toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Total</span>
                </div>
              </div>

              <div className="w-full mt-5 space-y-1.5 max-h-48 overflow-y-auto">
                {donutData.length === 0 && <p className="text-xs text-center text-slate-400">No chart data</p>}
                {donutData.map((slice, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 px-1 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full block" style={{ backgroundColor: slice.color }} />
                      <span className="font-medium text-slate-600 truncate max-w-[100px]">{slice.label}</span>
                    </div>
                    <span className="font-bold text-slate-700">{fmt(slice.amount)} <span className="text-slate-400 font-normal ml-0.5">({slice.percentage.toFixed(0)}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h4>
            <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 py-2 border border-blue-200 text-blue-600 bg-blue-50/30 hover:bg-blue-50 text-xs font-semibold rounded-lg transition-colors">
              <Download size={14} /> Export Expenses
            </button>
            <button onClick={() => navigate('/reports')} className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors">
              <BarChart3 size={14} /> View in Daily Report
            </button>
          </div>
        </div>
      </div>

      {/* Render Modal if applicable */}
      {renderDetailsModal()}
      
    </div>
  );
}
