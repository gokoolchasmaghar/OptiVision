export default function BarcodeInput({ value, onChange, onGenerate }) {

  const generateEAN13 = () => {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (checksum % 10)) % 10;
    return [...digits, checkDigit].join('');
  };

  const handleGenerate = () => {
    const code = generateEAN13();
    onChange(code);
    onGenerate?.(code); // optional hook
  };

  return (
    <div>
      <label className="field-label">Barcode Number</label>

      <div className="flex gap-2">
        <input
          className="field-input flex-1"
          placeholder="Auto-generated or manual"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />

        <button
          type="button"
          onClick={handleGenerate}
          className="px-3 py-2 rounded-lg border bg-slate-100 hover:bg-slate-200"
        >
          🔄
        </button>
      </div>
    </div>
  );
}