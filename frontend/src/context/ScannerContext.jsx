import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useRef } from "react";
import toast from "react-hot-toast";

const ScannerContext = createContext();

export const useScanner = () => useContext(ScannerContext);

export const ScannerProvider = ({ children }) => {
  const [buffer, setBuffer] = useState("");
  const [product, setProduct] = useState(null);
  const timeoutRef = useRef(null);
  const lastScanRef = useRef("");

  useEffect(() => {
    let timeout;

    const handleKeyDown = async (e) => {
      // 1. Ignore typing inside inputs / textareas
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // 2. Ignore special/control keys
      if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta"
      ) return;

      if (e.key === "Enter") {
        if (!buffer.trim()) return;

        const now = Date.now();

        // Prevent ultra-fast duplicate scans
        if (now - lastScanRef.current < 300) return;
        lastScanRef.current = now;

        document.activeElement.blur();

        try {
          const res = await api.get(`/products/scan/${buffer}`);

          // Replace popup instantly
          setProduct(res.data);

          // SUCCESS SOUND
          toast.success(`Scanned: ${res.data.data?.name || res.data.data?.brand || res.data.data?.model || 'Item'}`);
          // new Audio("/success.mp3").play();
        } catch {
          toast.error(`No product found for barcode: ${buffer}`);
          // new Audio("/error.mp3").play();
        }

        setBuffer("");
        return;
      }

      // 4. Only allow valid characters (avoid junk)
      if (e.key.length > 1) return;

      // 5. Append to buffer
      setBuffer((prev) => prev + e.key);

      // 6. Reset buffer if typing is slow (not a scanner)
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setBuffer("");
      }, 300);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buffer]);

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
            <div className="text-center mb-5">
              <div className="text-xs uppercase tracking-wide text-gray-400">
                {product.type}
              </div>
              <h2 className="text-xl font-bold text-gray-800 mt-1">
                {product.data.name || product.data.model}
              </h2>
              <p className="text-sm text-gray-500">
                {product.data.brand || "No Brand"}
              </p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-400 text-xs">Barcode</div>
                <div className="font-medium">{product.data.barcode}</div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-400 text-xs">Stock</div>
                <div
                  className={`font-semibold ${product.data.stockQty <= product.data.lowStockAlert
                    ? "text-red-500"
                    : "text-gray-800"
                    }`}
                >
                  {product.data.stockQty}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-green-600 text-xs">Selling</div>
                <div className="font-bold text-green-700">
                  ₹{product.data.sellingPrice}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-400 text-xs">Purchase</div>
                <div className="font-medium">
                  ₹{product.data.purchasePrice}
                </div>
              </div>
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
