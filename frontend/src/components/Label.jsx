import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function Label({ product }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    const svg = barcodeRef.current;
    if (!svg) return;

    if (!product?.barcode) {
      svg.innerHTML = "";
      return;
    }

    JsBarcode(svg, product.barcode, {
      format: "CODE128",
      width: 1.8,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 0,
    });
  }, [product]);

  if (!product) return null;

  const isLens = product.lensType; // Check if it's a lens
  const model = isLens ? product.name : product.model;
  const color = isLens ? product.lensType?.replace('_', ' ') : product.color;
  const size = isLens ? product.lensIndex : product.size;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 20px",
        borderRadius: "22px",
        background: "#ffffff",
        width: "450px",
        minHeight: "100px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "26px",
              letterSpacing: "-0.03em",
              color: "#111827",
            }}
          >
            {product.brand}
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "14px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {model}
          </p>
        </div>

        <div style={{ margin: "16px 0 18px" }}>
          <span
            style={{
              fontSize: "30px",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            ₹{product.sellingPrice}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "18px",
            alignItems: "center",
            fontSize: "13px",
            color: "#4B5563",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <span style={{ fontWeight: 700 }}>{color || "N/A"}</span>
          <span
            style={{
              width: "1px",
              height: "20px",
              background: "#D1D5DB",
              display: "inline-block",
            }}
          />
          <span>{isLens ? `Index ${size}` : `Size ${size || "—"}`}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "185px",
          marginLeft: "18px",
        }}
      >
        <svg ref={barcodeRef} style={{ width: "100%", maxWidth: "190px" }} />
      </div>
    </div>
  );
}