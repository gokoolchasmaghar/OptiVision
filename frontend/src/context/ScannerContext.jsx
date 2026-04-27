import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useRef } from "react";

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

      console.log("Key:", e.key);
      console.log("Buffer:", buffer);

      // 2. Ignore special/control keys
      if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta"
      ) return;

      // 3. Handle Enter (scanner end signal)
      if (e.key === "Enter") {
        if (buffer === lastScanRef.current) return;
        lastScanRef.current = buffer;

        try {
          const res = await api.get(`/products/scan/${buffer}`);
          setProduct(res.data);

          setTimeout(() => {
            setProduct(null);
          }, 4000);

          // SUCCESS SOUND
          new Audio("/success.mp3").play();
        } catch {
          // ERROR SOUND
          new Audio("/error.mp3").play();
        }

        console.log("SCANNED:", buffer);

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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={() => setProduct(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 relative animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setProduct(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>

            {/* Type */}
            <h2 className="text-xl font-bold text-center mb-4 capitalize">
              {product.type}
            </h2>

            {/* Product Info */}
            <div className="space-y-2 text-sm">
              <p><b>Name:</b> {product.data.name || product.data.model}</p>
              <p><b>Brand:</b> {product.data.brand || "-"}</p>
              <p><b>Barcode:</b> {product.data.barcode}</p>

              <p>
                <b>Selling Price:</b>{" "}
                <span className="text-green-600 font-semibold">
                  ₹{product.data.sellingPrice}
                </span>
              </p>

              <p>
                <b>Purchase Price:</b>{" "}
                ₹{product.data.purchasePrice}
              </p>

              <p>
                <b>Stock:</b>{" "}
                <span
                  className={
                    product.data.stockQty <= product.data.lowStockAlert
                      ? "text-red-500 font-bold"
                      : ""
                  }
                >
                  {product.data.stockQty}
                </span>
              </p>
            </div>

            {/* Optional action */}
            <button
              onClick={() => setProduct(null)}
              className="mt-5 w-full bg-gray-100 hover:bg-gray-200 rounded-lg py-2 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ScannerContext.Provider>
  );
};