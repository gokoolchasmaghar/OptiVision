import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Label, { PrintLabelButton } from '../components/Label';
import { useAuthStore } from '../stores/authStore';
import { isAdmin } from '../utils/roles';
import { Html5Qrcode } from 'html5-qrcode';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const categories = ['ALL', 'SUNGLASSES', 'CASE', 'SOLUTION', 'CLOTH', 'OTHER'];

export default function Accessories() {
    const { user } = useAuthStore();
    const canManageAccessories = isAdmin(user);
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('ALL');
    const [editingItem, setEditingItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [printQty, setPrintQty] = useState(1);
    const [scanInput, setScanInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef(null);
    const scannerReadyRef = useRef(false);

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        name: '',
        category: 'SUNGLASSES',
        purchasePrice: '',
        sellingPrice: '',
        stockQty: '',
        lowStockAlert: '5',
        barcode: '',
        modelCode: '',
    });

    // ── Barcode generation ──────────────────────────────────────────────────────
    const generateEAN13 = () => {
        const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
        const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
        const checkDigit = (10 - (checksum % 10)) % 10;
        return [...digits, checkDigit].join('');
    };

    const handleGenerateBarcode = () => {
        setForm(f => ({ ...f, barcode: generateEAN13() }));
        toast.success('Barcode generated!');
    };

    // ── Scanner ─────────────────────────────────────────────────────────────────
    const stopScanner = async () => {
        scannerReadyRef.current = false;
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { /* ignore */ }
            try { await scannerRef.current.clear(); } catch { /* ignore */ }
            scannerRef.current = null;
        }
        setScanning(false);
    };

    const startScanner = async () => {
        if (scannerRef.current || scannerReadyRef.current) return;

        await new Promise(r => setTimeout(r, 50));

        const scanner = new Html5Qrcode('reader-accessories');
        scannerRef.current = scanner;

        const onSuccess = async (decodedText) => {
            setForm(f => ({ ...f, barcode: decodedText }));
            toast.success('Barcode scanned!');
            await stopScanner();
        };

        const tryStart = async (constraints) => {
            try {
                await scanner.start(constraints, { fps: 10, qrbox: { width: 250, height: 150 } }, onSuccess, () => { });
                scannerReadyRef.current = true;
                setScanning(true);
            } catch (err) {
                if (constraints.facingMode === 'environment') {
                    await tryStart({ facingMode: 'user' });
                } else if (constraints.facingMode === 'user') {
                    await tryStart({});
                } else {
                    scannerRef.current = null;
                    toast.error('Could not access camera. Please allow camera permission.');
                }
            }
        };

        await tryStart({ facingMode: 'environment' });
    };

    const toggleScanner = () => {
        if (scanning) {
            stopScanner();
        } else {
            startScanner();
        }
    };

    // 📦 Fetch data
    const fetchData = async () => {
        try {
            const res = await api.get('/accessories', {
                params: { search, category },
            });
            setItems(res.data.data);
        } catch (e) {
            toast.error('Failed to load accessories');
        }
    };

    useEffect(() => {
        fetchData();
    }, [search, category]);

    // ── Cleanup scanner on component unmount or modal close ──────────────────
    useEffect(() => {
        return () => {
            if (scanning) stopScanner();
        };
    }, [scanning]);

    // ── Stop scanner when modal closes ───────────────────────────────────────
    const handleCloseModal = () => {
        if (scanning) stopScanner();
        setShowModal(false);
        setEditingItem(null);
    };

    // ➕ Create
    const handleSave = async () => {

        const cleanData = {
            ...form,
            barcode: form.barcode || undefined,
            purchasePrice: Number(form.purchasePrice) || 0,
            sellingPrice: Number(form.sellingPrice),
            stockQty: Number(form.stockQty) || 0,
            lowStockAlert: Number(form.lowStockAlert) || 5,
        };

        try {
            if (editingItem) {
                // ✏️ UPDATE
                await api.put(`/accessories/${editingItem.id}`, form);
                toast.success('Updated successfully');
            } else {
                // ➕ CREATE
                await api.post('/accessories', form);
                toast.success('Accessory added');
            }

            setShowModal(false);
            setEditingItem(null);

            setForm({
                name: '',
                category: 'SUNGLASSES',
                sellingPrice: '',
                purchasePrice: '',
                stockQty: '',
                barcode: '',
            });

            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Error');
        }
    };

    // ❌ Delete
    const handleDelete = async id => {
        if (!confirm('Delete this item?')) return;

        try {
            await api.delete(`/accessories/${id}`);
            toast.success('Deleted');
            fetchData();
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleScan = async (e) => {
        if (e.key !== 'Enter') return;

        const raw = scanInput;

        const barcode = String(raw)
            .replace(/[\r\n]+/g, '')
            .trim();

        console.log("RAW:", raw);
        console.log("CLEAN:", barcode);

        if (!barcode) return;

        try {
            const res = await api.get(`/accessories/barcode/${barcode}`);
            const product = res.data?.data;

            if (!product) {
                toast.error("Product not found");
                return;
            }

            // 👉 Open label modal directly
            setSelectedItem(product);
            setPrintQty(1);

            toast.success("Product found");

        } catch {
            toast.error("Product not found");
        }

        setScanInput('');
    };

    return (
        <div>
            {/* 🔷 Header */}
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h1 className="text-2xl font-bold">Accessories</h1>
                    <p className="text-sm text-slate-500">{items.length} items</p>
                </div>

                {canManageAccessories && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary btn-sm px-4 py-2 rounded-xl flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Accessory
                    </button>
                )}
            </div>

            {/* 🔍 Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        autoFocus
                        className="field-input pl-8"
                        placeholder="Search or scan barcode..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={async (e) => {
                            if (e.key !== "Enter") return;

                            const barcode = String(search)
                                .replace(/[\r\n]+/g, "")
                                .trim();

                            if (!barcode) return;

                            try {
                                const res = await api.get(`/accessories/barcode/${barcode}`);
                                const product = res.data?.data;

                                if (!product) {
                                    toast.error("Product not found");
                                    return;
                                }

                                // 👉 open label modal (same flow you already use)
                                setSelectedItem(product);
                                setPrintQty(1);

                            } catch {
                                toast.error("Product not found");
                            }

                            setSearch(""); // clear after scan
                        }}
                    />
                </div>

                <div className="flex gap-2 flex-wrap">
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`btn-sm ${category === c ? 'btn-primary' : 'btn-secondary'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* 🧱 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {items.map(i => (
                    <div
                        key={i.id}
                        className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition"
                    >
                        {/* Top */}
                        <div className="h-32 bg-slate-100 flex items-center justify-center relative">
                            <div className="text-3xl">
                                {i.category === 'SUNGLASSES' ? '🕶️' :
                                    i.category === 'SOLUTION' ? '🧴' :
                                        i.category === 'CASE' ? '📦' : '🛍️'}
                            </div>

                            {(() => {
                                if (i.stockQty === 0) {
                                    return (
                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">
                                            Out of Stock
                                        </span>
                                    );
                                }

                                if (i.stockQty <= i.lowStockAlert) {
                                    return (
                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold">
                                            Low Stock ({i.stockQty})
                                        </span>
                                    );
                                }

                                return (
                                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-semibold">
                                        {i.stockQty} in stock
                                    </span>
                                );
                            })()}
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-2">
                            {/* Category + Stock */}
                            <div className="flex justify-between items-center">
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-semibold">
                                    {i.category}
                                </span>

                                {i.stockQty > 0 && (
                                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-semibold">
                                        {i.stockQty} in stock
                                    </span>
                                )}
                            </div>

                            {/* Name */}
                            <div className="font-semibold text-slate-800 text-sm">
                                {i.name}
                            </div>

                            {/* Price */}
                            <div className="font-bold text-lg">
                                {fmt(i.sellingPrice)}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-2">
                                {/* Label */}
                                {/* <Label item={i} type="accessory" /> */}
                                <button
                                    onClick={() => {
                                        setSelectedItem(i);
                                        setPrintQty(1);
                                    }}
                                    className="px-3 py-1 rounded-full border text-xs hover:bg-slate-50"
                                >
                                    Label
                                </button>

                                {canManageAccessories && (
                                    <div className="flex gap-3 text-xs">
                                        <button
                                            onClick={() => {
                                                setEditingItem(i);
                                                setForm({
                                                    name: i.name || '',
                                                    category: i.category || 'SUNGLASSES',
                                                    sellingPrice: i.sellingPrice || '',
                                                    purchasePrice: i.purchasePrice || '',
                                                    modelCode: i.modelCode || '',
                                                    stockQty: i.stockQty || '',
                                                    barcode: i.barcode || '',
                                                    lowStockAlert: i.lowStockAlert || '2',
                                                });
                                                setShowModal(true);
                                            }}
                                            className="btn-ghost btn-xs"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(i.id)}
                                            className="btn-danger btn-xs"
                                        >
                                            Del
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

                    {/* Modal */}
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden m-2">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingItem ? 'Edit Accessory' : 'Add Accessory'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 max-h-[70vh] overflow-y-auto">

                            <div className="grid grid-cols-2 gap-5">

                                {/* Name */}
                                <div>
                                    <label className="field-label">Name *</label>
                                    <input
                                        className="field-input"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="field-label">Category</label>
                                    <select
                                        className="field-select"
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    >
                                        {categories.slice(1).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Model Code */}
                                <div>
                                    <label className="field-label">Model Code</label>
                                    <input
                                        className="field-input"
                                        value={form.modelCode || ''}
                                        onChange={e => setForm(f => ({ ...f, modelCode: e.target.value }))}
                                    />
                                </div>

                                {/* Barcode */}
                                <div>
                                    <label className="field-label">Barcode</label>

                                    <div className="flex gap-2 mb-2">
                                        <input
                                            className="field-input flex-1 font-mono"
                                            value={form.barcode}
                                            onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                                            placeholder="Scan or enter barcode number"
                                        />

                                        <button
                                            type="button"
                                            className="btn-secondary btn-sm whitespace-nowrap"
                                            onClick={handleGenerateBarcode}
                                            title="Auto-generate EAN-13"
                                        >
                                            🔄 Generate
                                        </button>

                                        <button
                                            type="button"
                                            className={`btn-sm whitespace-nowrap ${scanning ? 'btn-danger' : 'btn-secondary'}`}
                                            onClick={toggleScanner}
                                            title={scanning ? 'Stop camera' : 'Scan with camera'}
                                        >
                                            {scanning ? '⏹ Stop' : '📷 Scan'}
                                        </button>
                                    </div>

                                    {/* Camera feed */}
                                    <div
                                        id="reader-accessories"
                                        style={{
                                            width: '100%',
                                            height: scanning ? '260px' : '0px',
                                            overflow: 'hidden',
                                            borderRadius: '8px',
                                            border: scanning ? '2px solid #3b82f6' : 'none',
                                            transition: 'height 0.2s ease',
                                            background: '#000',
                                        }}
                                    />
                                    {scanning && (
                                        <div className="text-xs text-blue-600 font-medium mt-2 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                            Scanning... Point camera at barcode
                                        </div>
                                    )}
                                </div>

                                {/* Purchase Price */}
                                <div>
                                    <label className="field-label">Purchase Price ₹</label>
                                    <input
                                        className="field-input"
                                        type="number"
                                        value={form.purchasePrice}
                                        onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                                    />
                                </div>

                                {/* Selling Price */}
                                <div>
                                    <label className="field-label">Selling Price ₹ *</label>
                                    <input
                                        className="field-input"
                                        type="number"
                                        value={form.sellingPrice}
                                        onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))}
                                    />
                                </div>

                                {/* Stock */}
                                <div>
                                    <label className="field-label">Stock Qty</label>
                                    <input
                                        className="field-input"
                                        type="number"
                                        value={form.stockQty}
                                        onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))}
                                    />
                                </div>

                                {/* Low Stock Alert */}
                                <div>
                                    <label className="field-label">
                                        Low Stock Alert
                                        <span className="text-xs text-slate-400 ml-1">(warning threshold)</span>
                                    </label>
                                    <input
                                        className="field-input"
                                        type="number"
                                        value={form.lowStockAlert}
                                        onChange={e => setForm(f => ({ ...f, lowStockAlert: e.target.value }))}
                                    />
                                </div>

                            </div>

                            {/* Margin Box */}
                            {form.purchasePrice && form.sellingPrice && (
                                <div className="mt-5 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm">
                                    <span className="text-emerald-700 font-semibold">
                                        Margin: {Math.round(
                                            (form.sellingPrice - form.purchasePrice) / form.sellingPrice * 100
                                        )}%
                                    </span>
                                    <span className="text-emerald-600 ml-3">
                                        Profit: ₹{form.sellingPrice - form.purchasePrice} per unit
                                    </span>
                                </div>
                            )}

                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
                            <button
                                onClick={handleCloseModal}
                                className="btn-secondary btn-md"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleSave}
                                className="btn-primary btn-md"
                            >
                                {editingItem ? 'Update Accessory' : 'Add Accessory'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/*  Label Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-lg">

                        {/* Quantity */}
                        <div className="mt-2 flex items-center gap-2">
                            <label className="text-sm font-medium">Quantity:</label>
                            <input
                                type="number"
                                min="1"
                                value={printQty}
                                onChange={(e) => setPrintQty(Math.max(1, Number(e.target.value)))}
                                className="field-input w-20"
                            />
                        </div>

                        {/* Label Preview */}
                        <Label
                            key={selectedItem.id}
                            product={{
                                ...selectedItem,
                                brand: selectedItem.name,
                                model: '',
                            }}
                        />

                        {/* Actions */}
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                className="btn-secondary btn-sm"
                                onClick={() => setSelectedItem(null)}
                            >
                                Close
                            </button>

                            <PrintLabelButton
                                product={{
                                    ...selectedItem,
                                    brand: selectedItem.name,
                                    model: '',
                                }}
                                quantity={printQty}
                                className="btn-primary btn-sm"
                            />
                        </div>

                    </div>
                </div>
            )}
        </div>
    );

    exports.getAccessoryByBarcode = async (req, res, next) => {
        try {
            const item = await prisma.accessory.findFirst({
                where: { barcode: req.params.barcode, storeId: req.storeId, isActive: true }
            });
            if (!item) return res.status(404).json({ success: false, message: 'Not found' });
            res.json({ success: true, data: item });
        } catch (err) { next(err); }
    };
}
