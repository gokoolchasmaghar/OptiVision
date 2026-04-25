import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function BarcodeInput({ value, onChange, onGenerate }) {
  const navigate = useNavigate();

  const generateEAN13 = () => {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (checksum % 10)) % 10;
    return [...digits, checkDigit].join('');
  };

  const handleGenerate = () => {
    const code = generateEAN13();
    onChange(code);
    onGenerate?.(code);
  };

  // 🔥 NEW: scan + navigate logic
  const handleScan = async () => {
    if (!value) return;

    try {
      const res = await api.get(`/barcode/${value}`);
      const result = res.data;

      if (result.success) {
        if (result.type === "FRAME") {
          navigate(`/frames/${result.data.id}`);
        }
        else if (result.type === "LENS") {
          navigate(`/lenses/${result.data.id}`);
        }
        else if (result.type === "ACCESSORY") {
          navigate(`/accessories/${result.data.id}`);
        }
        else if (result.type === "ORDER") {
          navigate(`/orders/${result.data.id}`);
        }
      }
    } catch (err) {
      toast.error('Not found');
    }
  };

  return (
    <div>
      <label className="field-label">Barcode Number</label>

      <div className="flex gap-2">
        <input
          className="field-input flex-1"
          placeholder="Scan / enter barcode"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // optional but safer (prevents form submit)
              handleScan();
            }
          }}
        />

        {/* 🔄 Generate */}
        <button
          type="button"
          onClick={handleGenerate}
          className="px-3 py-2 rounded-lg border bg-slate-100 hover:bg-slate-200"
        >
          🔄
        </button>

        {/* 🔍 Scan */}
        <button
          type="button"
          onClick={handleScan}
          className="px-3 py-2 rounded-lg border bg-blue-100 hover:bg-blue-200"
        >
          🔍
        </button>
      </div>
    </div>
  );
}