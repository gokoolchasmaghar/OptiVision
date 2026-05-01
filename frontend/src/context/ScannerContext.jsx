import { createContext, useContext, useEffect, useState, useRef } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

const ScannerContext = createContext();

export const useScanner = () => useContext(ScannerContext);

export const ScannerProvider = ({ children }) => {
  const [buffer, setBuffer] = useState("");
  const [product, setProduct] = useState(null);
  const timeoutRef = useRef(null);
  const lastScanRef = useRef(0);

  // ─────────────────────────────────────────────
  // 🔍 SCANNER LISTENER
  // ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = async (e) => {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

      if (e.key === "Enter") {
        if (!buffer.trim()) return;

        const now = Date.now();
        if (now - lastScanRef.current < 300) return;
        lastScanRef.current = now;

        document.activeElement.blur();

        try {
          const res = await api.get(`/products/scan/${buffer}`);
          setProduct(res.data);

          toast.success(
            `Scanned: ${
              res.data?.data?.name ||
              res.data?.data?.brand ||
              res.data?.data?.model ||
              "Item"
            }`
          );
        } catch {
          toast.error(`No product found for barcode: ${buffer}`);
        }

        setBuffer("");
        return;
      }

      if (e.key.length > 1) return;

      setBuffer((prev) => prev + e.key);

      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setBuffer("");
      }, 300);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buffer]);

  // ─────────────────────────────────────────────
  // 🔥 AUTO CLOSE POPUP (Retail UX)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!product) return;

    const timer = setTimeout(() => {
      setProduct(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [product]);

  // ─────────────────────────────────────────────
  // 🧩 FIELD COMPONENT (SAFE)
  // ─────────────────────────────────────────────
  const Field = ({ label, value, highlight }) => (
    <div
      className={`rounded-lg p-3 ${
        highlight ? "bg-green-50" : "bg-gray-50"
      }`}
    >
      <div
        className={`text-xs ${
          highlight ? "text-green-600" : "text-gray-400"
        }`}
      >
        {label}
      </div>
      <div
        className={`font-medium ${
          highlight ? "text-green-700 font-bold" : ""
        }`}
      >
        {value !== undefined && value !== null && value !== ""
          ? value
          : "-"}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // 🛡️ SAFE DATA EXTRACTION
  // ─────────────────────────────────────────────
  const data = product?.data || {};
  const type = (product?.type || "").toLowerCase();

  return (
    <ScannerContext.Provider value={{ product, setProduct }}>
      {children}

      {/* GLOBAL POPUP */}
      {product && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]"
          onClick={() => setProduct(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-[420px] p-6 relative animate-scaleIn border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setProduct(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-lg"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center mb-4">
              <div className="text-xs text-gray-400 font-mono">
                {data.barcode}
              </div>

              <h2 className="text-lg font-bold text-gray-800 mt-1">
                {data.name || data.model}
              </h2>

              <p className="text-sm text-gray-500">
                {data.brand || "No Brand"}
              </p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* FRAME */}
              {type === "frame" && (
                <>
                  <Field label="Model" value={data.model} />
                  <Field label="Shape" value={data.shape} />
                  <Field label="Size" value={data.size} />
                  <Field label="Color" value={data.color} />
                  <Field label="Material" value={data.material} />
                  <Field label="Gender" value={data.gender} />
                </>
              )}

              {/* LENS */}
              {type === "lens" && (
                <>
                  <Field label="Lens Type" value={data.lensType} />
                  <Field label="Index" value={data.lensIndex} />
                </>
              )}

              {/* ACCESSORY */}
              {type === "accessory" && (
                <>
                  <Field label="Category" value={data.category} />
                </>
              )}

              {/* COMMON */}
              <Field
                label="Stock"
                value={
                  <span
                    className={
                      data.stockQty <= data.lowStockAlert
                        ? "text-red-500 font-semibold"
                        : ""
                    }
                  >
                    {data.stockQty}
                  </span>
                }
              />

              <Field label="Low Alert" value={data.lowStockAlert} />

              <Field
                label="Selling"
                value={`₹${data.sellingPrice}`}
                highlight
              />
            </div>

            {/* Footer */}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setProduct(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ScannerContext.Provider>
  );
};