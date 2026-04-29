import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import api from '../services/api';
import { PageHeader } from '../components/ui';
import toast from 'react-hot-toast';
import { useNavigate } from "react-router-dom";

const TYPES = [
    { value: 'frame', label: 'Frames', icon: '🕶️', desc: 'brand, model, barcode, sellingPrice, stockQty, color, size, shape' },
    { value: 'lens', label: 'Lenses', icon: '🔬', desc: 'name, brand, lensType, lensIndex, sellingPrice, stockQty, coating' },
    { value: 'accessory', label: 'Accessories', icon: '🧴', desc: 'name, brand, barcode, sellingPrice, stockQty' },
];

// ── Sample CSV download ───────────────────────────────────────────────────────
const SAMPLES = {
    frame: `storeId,frameCode,brand,model,shape,size,color,material,gender,purchasePrice,sellingPrice,stockQty,lowStockAlert,barcode,sku,modelCode
store-GO-KOOL CHASMAGHAR-001,FR001,RayBan,RB2140,RECTANGLE,52-18-140,Black,Acetate,Unisex,1800,3200,12,5,,SKU-FR-001,RB2140-BLK
store-GO-KOOL CHASMAGHAR-001,FR002,Titan Eye+,TE1023,ROUND,50-20-145,Brown,Metal,Unisex,950,1800,8,3,8901234500012,SKU-FR-002,TE1023-BRN
store-GO-KOOL CHASMAGHAR-001,FR003,Fastrack,FT4455,SQUARE,54-18-140,Blue,Plastic,Men,700,1500,20,6,8901234500013,SKU-FR-003,FT4455-BLU
store-GO-KOOL CHASMAGHAR-001,FR004,Oakley,OX8046,RECTANGLE,55-18-138,Grey,Metal,Men,2500,4500,6,2,8901234500014,SKU-FR-004,OX8046-GRY
store-GO-KOOL CHASMAGHAR-001,FR005,Vogue,VO2606,CAT_EYE,51-19-140,Black,Acetate,Women,1200,2500,15,5,8901234500015,SKU-FR-005,VO2606-BLK
store-GO-KOOL CHASMAGHAR-001,FR006,Carrera,CA8821,AVIATOR,57-16-140,Silver,Metal,Men,2000,3800,9,3,8901234500016,SKU-FR-006,CA8821-SLV`,

    lens: `storeId,name,lensType,lensIndex,coating,brand,barcode,sku,modelCode,purchasePrice,sellingPrice,stockQty,lowStockAlert
store-GO-KOOL CHASMAGHAR-001,Essilor Basic SV,SINGLE_VISION,1.50,Anti-Glare|UV400,Essilor,,SKU-LENS-001,ESS-1.50,300,800,30,10
store-GO-KOOL CHASMAGHAR-001,Essilor Blue Cut,SINGLE_VISION,1.56,Blue Cut|Anti-Scratch,Essilor,8902234500012,SKU-LENS-002,ESS-1.56,500,1300,25,10
store-GO-KOOL CHASMAGHAR-001,Crizal Sapphire HR,SINGLE_VISION,1.67,Anti-Glare|Scratch Resistant,Crizal,8902234500013,SKU-LENS-003,CRZ-1.67,1500,3500,10,10
store-GO-KOOL CHASMAGHAR-001,Zeiss Digital Lens,SINGLE_VISION,1.61,Blue Cut|UV400,Zeiss,8902234500014,SKU-LENS-004,ZSS-1.61,1800,4200,8,10
store-GO-KOOL CHASMAGHAR-001,Hoya Blue Control,SINGLE_VISION,1.56,Blue Cut|Anti-Glare,Hoya,8902234500015,SKU-LENS-005,HOY-1.56,700,1800,18,10
store-GO-KOOL CHASMAGHAR-001,Kodak UV Lens,SINGLE_VISION,1.50,UV400,Kodak,8902234500016,SKU-LENS-006,KDK-1.50,350,900,22,10`,

    accessory: `storeId,name,category,modelCode,barcode,sku,purchasePrice,sellingPrice,stockQty,lowStockAlert
store-GO-KOOL CHASMAGHAR-001,RayBan Aviator Sunglasses,SUNGLASSES,RB-SG-101,8903234500011,SKU-ACC-001,2000,4000,8,3
store-GO-KOOL CHASMAGHAR-001,Hard Case Black,CASE,HC-BLK-01,8903234500012,SKU-ACC-002,150,400,25,10
store-GO-KOOL CHASMAGHAR-001,Lens Cleaning Solution,SOLUTION,LCS-100,8903234500013,SKU-ACC-003,80,200,30,10
store-GO-KOOL CHASMAGHAR-001,Microfiber Cloth,CLOTH,MC-01,8903234500014,SKU-ACC-004,20,100,50,15
store-GO-KOOL CHASMAGHAR-001,Fastrack Sunglasses,SUNGLASSES,FT-SG-202,8903234500015,SKU-ACC-005,800,1700,20,6
store-GO-KOOL CHASMAGHAR-001,Generic Accessories,OTHER,GEN-001,8903234500016,SKU-ACC-006,100,300,15,5`,
};

function downloadSample(type) {
    const csv = SAMPLES[type];
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function BulkImport() {
    const [file, setFile] = useState(null);
    const [type, setType] = useState('frame');
    const [preview, setPreview] = useState(null);  // null = not previewed yet
    const [previewStats, setPreviewStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [result, setResult] = useState(null);
    const [step, setStep] = useState(1); // 1=select, 2=preview, 3=done
    const [duplicateMode, setDuplicateMode] = useState("update");
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const selectedType = TYPES.find(t => t.value === type);

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        setPreview(null);
        setResult(null);
        setStep(1);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) {
            setFile(f);
            setPreview(null);
            setResult(null);
            setStep(1);
        } else {
            toast.error('Only CSV or Excel files allowed');
        }
    };

    const handlePreview = async () => {
        if (!file) return toast.error('Select a file first');
        setPreviewing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            const res = await api.post('/import/preview', formData);
            setPreview(res.data.preview);
            setPreviewStats({ total: res.data.total, valid: res.data.valid, invalid: res.data.invalid });
            setStep(2);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Preview failed');
        }
        setPreviewing(false);
    };

    const handleImport = async () => {
        if (!file) return toast.error('Select a file first');
        if (!preview) return toast.error('Preview first before importing');
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            formData.append("duplicateMode", duplicateMode);
            const res = await api.post('/import', formData);
            setResult(res.data);
            setStep(3);
            if (res.data.imported > 0) {
                toast.success(`${res.data.imported} records imported successfully!`);
            }
            if (res.data.failed > 0) {
                toast.error(`${res.data.failed} rows failed — check errors below`);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Import failed');
        }
        setLoading(false);
    };

    const reset = () => {
        setFile(null);
        setPreview(null);
        setPreviewStats(null);
        setResult(null);
        setStep(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div>
            <PageHeader
                title="Bulk Import"
                subtitle="Import frames, lenses and accessories from CSV or Excel"
                action={
                    <button
                        onClick={() => navigate('/inventory')}
                        className="btn-secondary btn-md"
                    >
                        ← Back to Inventory
                    </button>
                }
            />

            <div className="max-w-4xl space-y-5">

                {/* ── Step 1: Type + File ── */}
                <div className="card p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                        Select Type & Upload File
                    </h3>

                    {/* Type selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                        {TYPES.map(t => (
                            <button
                                key={t.value}
                                onClick={() => { setType(t.value); setPreview(null); setResult(null); setStep(1); }}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${type === t.value ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            >
                                <div className="text-2xl mb-1">{t.icon}</div>
                                <div className={`font-bold text-sm ${type === t.value ? 'text-primary-700' : 'text-slate-700'}`}>{t.label}</div>
                                <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">Cols: {t.desc}</div>
                            </button>
                        ))}
                    </div>

                    {/* Download sample */}
                    <button
                        onClick={() => downloadSample(type)}
                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mb-4"
                    >
                        <Download size={14} />
                        Download sample CSV for {selectedType?.label}
                    </button>

                    {/* Drop zone */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${file ? 'border-primary-400 bg-primary-50' : 'border-slate-300 hover:border-primary-300 hover:bg-slate-50'}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileText size={28} className="text-primary-500" />
                                <div className="font-semibold text-primary-700 text-sm">{file.name}</div>
                                <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <Upload size={28} />
                                <div className="font-semibold text-sm">Drop CSV or Excel file here</div>
                                <div className="text-xs">or click to browse · Max 5MB</div>
                            </div>
                        )}
                    </div>

                    {/* Duplicate handling mode */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Handle Duplicates
                        </label>

                        <select
                            value={duplicateMode}
                            onChange={(e) => setDuplicateMode(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-400 outline-none"
                        >
                            <option value="update"> Increase Stock</option>
                            <option value="skip"> Skip Duplicates</option>
                            <option value="replace"> Replace Existing Data</option>
                        </select>

                        <p className="text-xs text-slate-400 mt-1">
                            Choose how duplicate barcodes should be handled during import.
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <button
                            onClick={handlePreview}
                            disabled={!file || previewing}
                            className="btn-secondary btn-md flex-1 justify-center"
                        >
                            {previewing ? 'Previewing…' : '👁 Preview Data'}
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!file || !preview || loading || step === 3}
                            className="btn-primary btn-md flex-1 justify-center"
                        >
                            {loading ? 'Importing…' : `⬆ Import ${selectedType?.label}`}
                        </button>
                    </div>
                </div>

                {/* ── Step 2: Preview ── */}
                {preview && step >= 2 && (
                    <div className="card p-5">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            Preview
                            {previewStats && (
                                <span className="ml-auto flex gap-3 text-sm font-normal">
                                    <span className="text-slate-500">Total: <b>{previewStats.total}</b></span>
                                    <span className="text-emerald-600">✅ Valid: <b>{previewStats.valid}</b></span>
                                    {previewStats.invalid > 0 && <span className="text-red-500">❌ Errors: <b>{previewStats.invalid}</b></span>}
                                </span>
                            )}
                        </h3>

                        {/* Stats bar */}
                        {previewStats && previewStats.total > 0 && (
                            <div className="flex rounded-full overflow-hidden h-2 mb-4">
                                <div
                                    className="bg-emerald-400 transition-all"
                                    style={{ width: `${(previewStats.valid / previewStats.total) * 100}%` }}
                                />
                                <div
                                    className="bg-red-400 transition-all"
                                    style={{ width: `${(previewStats.invalid / previewStats.total) * 100}%` }}
                                />
                            </div>
                        )}

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="tbl min-w-[500px]">
                                <thead>
                                    <tr>
                                        <th className="w-10">#</th>
                                        {type === 'frame' && <><th>Brand</th><th>Model</th><th>Barcode</th><th>Price</th><th>Stock</th></>}
                                        {type === 'lens' && <><th>Name</th><th>Type</th><th>Index</th><th>Price</th><th>Stock</th></>}
                                        {type === 'accessory' && <><th>Name</th><th>Brand</th><th>Price</th><th>Stock</th></>}
                                        <th className="w-24">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map(row => (
                                        <tr key={row.rowNumber} className={row.error ? 'bg-red-50' : ''}>
                                            <td className="text-xs text-slate-400">{row.rowNumber}</td>
                                            {type === 'frame' && (
                                                <>
                                                    <td className="font-medium text-sm">{row.data.brand || '—'}</td>
                                                    <td className="text-sm">{row.data.model || '—'}</td>
                                                    <td className="font-mono text-xs">{row.data.barcode || '—'}</td>
                                                    <td className="text-sm">₹{row.data.sellingprice || row.data.price || '—'}</td>
                                                    <td className="text-sm">{row.data.stockqty || row.data.stock || '0'}</td>
                                                </>
                                            )}
                                            {type === 'lens' && (
                                                <>
                                                    <td className="font-medium text-sm">{row.data.name || '—'}</td>
                                                    <td className="text-xs">{row.data.lenstype || row.data.type || '—'}</td>
                                                    <td className="text-xs">{row.data.lensindex || row.data.index || '—'}</td>
                                                    <td className="text-sm">₹{row.data.sellingprice || row.data.price || '—'}</td>
                                                    <td className="text-sm">{row.data.stockqty || row.data.stock || '—'}</td>
                                                </>
                                            )}
                                            {type === 'accessory' && (
                                                <>
                                                    <td className="font-medium text-sm">{row.data.name || '—'}</td>
                                                    <td className="text-sm">{row.data.brand || '—'}</td>
                                                    <td className="text-sm">₹{row.data.sellingprice || row.data.price || '—'}</td>
                                                    <td className="text-sm">{row.data.stockqty || row.data.stock || '—'}</td>
                                                </>
                                            )}
                                            <td>
                                                {row.error ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                                                        <XCircle size={12} /> {row.error}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                        <CheckCircle size={12} /> OK
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {previewStats?.total > 50 && (
                            <p className="text-xs text-slate-400 mt-2">Showing first 50 rows — all {previewStats.total} rows will be imported.</p>
                        )}
                    </div>
                )}

                {/* ── Step 3: Result ── */}
                {result && step === 3 && (
                    <div className="card p-5">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            Import Result
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div className="bg-slate-50 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-slate-800">{result.total}</div>
                                <div className="text-sm text-slate-500 mt-1">Total Rows</div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                <div className="text-3xl font-bold text-emerald-600">{result.imported}</div>
                                <div className="text-sm text-emerald-600 mt-1">✅ Imported</div>
                            </div>
                            <div className={`rounded-xl p-4 text-center ${result.failed > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                <div className={`text-3xl font-bold ${result.failed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{result.failed}</div>
                                <div className={`text-sm mt-1 ${result.failed > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{result.failed > 0 ? '❌ Failed' : '✅ No Errors'}</div>
                            </div>
                        </div>

                        {/* Error list */}
                        {result.errors?.length > 0 && (
                            <div className="mt-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-2">
                                    <AlertCircle size={14} /> Failed Rows
                                </div>
                                <div className="bg-red-50 rounded-xl border border-red-100 overflow-hidden">
                                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                        <table className="tbl min-w-[300px]">
                                            <thead>
                                                <tr><th className="w-16">Row</th><th>Error</th></tr>
                                            </thead>
                                            <tbody>
                                                {result.errors.map((e, i) => (
                                                    <tr key={i}>
                                                        <td className="text-xs text-slate-500">{e.row}</td>
                                                        <td className="text-xs text-red-600">{e.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                            <button onClick={reset} className="btn-secondary btn-md flex-1 justify-center">
                                Import Another File
                            </button>
                            <a href={`/${type === 'frame' ? 'frames' : type === 'lens' ? 'lenses' : 'inventory'}`}
                                className="btn-primary btn-md flex-1 justify-center text-center">
                                View {selectedType?.label} →
                            </a>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}