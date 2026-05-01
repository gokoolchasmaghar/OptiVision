import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT HELPER — TVS LP 46 Dlite | 100mm roll | 20mm label
// ─────────────────────────────────────────────────────────────
export function printLabels(labelHtml) {
  const win = window.open("", "_blank", "width=600,height=400");
  if (!win) {
    toast.error("Enable popups to print labels");
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          font-family: sans-serif;
          background: #fff;
        }

        /*
          TVS LP 46 Dlite:
            Physical roll width : 100mm
            Printable width     : ~72mm (hardware margin ~4mm each side)
            Label height        : 20mm
          We set @page to the physical stock size and centre the 70mm label.
        */
        @media print {
          @page {
            size: 100mm 20mm;
            margin: 0;
          }
          body { margin: 0; }
        }

        .container {
          width: 100mm;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* One label per physical label — force a page break after each */
        .label {
          width: 70mm;
          height: 20mm;

          /* Centre on the 100mm roll */
          margin: 0 auto;

          display: flex;
          align-items: center;
          justify-content: space-between;

          box-sizing: border-box;
          padding: 0.5mm 0;

          overflow: hidden;

          /* Critical: each label on its own page on the thermal roll */
          break-after: page;
          page-break-after: always;
          break-inside: avoid;
        }

        /* Left: Barcode Area */
        .barcode-section {
          width: 60%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1mm 2mm;   /* equal spacing both sides */
          border-right: 1px dashed #666;
          overflow: hidden;
        }

        /*
          Keep the SVG at its natural pixel size — do NOT use width:100% here.
          Percentage width distorts bar widths and breaks scannability.
        */
        .barcode-section svg {
          max-width: 100%;
          height: auto;
        }

        /* Right: Info Area */
        .details-section {
          width: 40%;
          padding-left: 1.5mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          line-height: 1.2;
          overflow: hidden;
          margin-left: 2mm;
        }

        .heading {
          font-weight: bold;
          font-size: 9.5px;

          white-space: normal;
          word-break: break-word;
          line-height: 1.1;

          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .subheading {
          font-size: 8.5px;

          white-space: normal;
          word-break: break-word;
          line-height: 1.1;

          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .price {
          font-weight: bold;
          font-size: 10px;
          margin-top: 0.5mm;
        }
      </style>
    </head>
    <body>
      <div class="container">${labelHtml}</div>
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.focus();
            window.print();
            window.close();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// ─────────────────────────────────────────────────────────────
// 🔢 BARCODE GENERATOR
// ─────────────────────────────────────────────────────────────
function buildBarcodeSvg(barcode) {
  if (!barcode) return "";
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    JsBarcode(svg, barcode, {
      format: "CODE128",
      width: 1.2,       // narrower bars to fit 58% of 70mm cleanly
      height: 24,       // reduced from 34 — fits 20mm label height with room to breathe
      textMargin: 1,
      displayValue: true,
      fontSize: 10,
    });

    /*
      ✅ FIX: Do NOT override width/height with "100%" here.
      JsBarcode calculates pixel-precise dimensions for the bar widths.
      Forcing percentage width stretches/squashes bars and breaks scannability.
      The CSS rule `max-width: 100%` in the print stylesheet handles overflow safely.
    */

    return svg.outerHTML;
  } catch (e) {
    console.error("Barcode generation error:", e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 🧩 PREVIEW COMPONENT (UI)
// ─────────────────────────────────────────────────────────────
export default function Label({ product }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !product?.barcode) return;

    /*
      ✅ FIX: Removed `ref.current.innerHTML = ""` before JsBarcode.
      JsBarcode overwrites the SVG content itself — manual clearing caused
      a visible blank flash on every re-render.
    */
    JsBarcode(ref.current, product.barcode, {
      format: "CODE128",
      width: 1.2,
      height: 24,
      textMargin: 1,
      displayValue: true,
      fontSize: 10,
      marginBottom: '4px',
    });
  }, [product]);

  if (!product) return null;

  return (
    <div style={{ padding: "10px" }}>
      {/* Preview is proportionally scaled to represent the 70mm × 20mm label */}
      <div
        style={{
          width: "280px",   // ~4× the 70mm label for screen readability
          height: "80px",
          display: "flex",
          background: "#fff",
          border: "1px solid #ccc",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Barcode column */}
        <div
          style={{
            flex: "0 0 55%",
            maxWidth: "55%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: "1px dashed #ccc",
            overflow: "hidden",
            padding: "2px 4px 2px 2px",
          }}
        >
          <svg
            ref={ref}
            style={{
              maxWidth: "100%",
              height: "auto",
              maxHeight: "64px",
              /* ✅ FIX: no explicit width/height — let JsBarcode control dimensions */
            }}
          />
        </div>

        {/* Details column */}
        <div
          style={{
            flex: "0 0 45%",
            maxWidth: "45%",
            marginLeft: "4px",
            padding: "4px 6px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12px",
              whiteSpace: "normal",
              wordBreak: "break-word",
              lineHeight: "1.1",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.brand}
          </div>

          <div
            style={{
              fontSize: "11px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name || product.model || ""}
          </div>

          <div style={{ fontSize: "10px" }}>
            {[product.color, product.size ? `${product.size}` : ""]
              .filter(Boolean)
              .join(" | ")}
          </div>
          
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12px",
              marginTop: "2px",
            }}
          >
            ₹{Number(product.sellingPrice || 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 🛡️ HTML SANITIZER
// ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT BUTTON
// ─────────────────────────────────────────────────────────────
export function PrintLabelButton({ product, quantity = 1, className = "" }) {
  const handlePrint = () => {
    if (!product) return;

    const barcodeSvg = buildBarcodeSvg(product.barcode);

    const price = `₹${Number(product.sellingPrice || 0).toLocaleString("en-IN")}`;

    let line1 = "";
    let line2 = "";
    let line3 = "";

    // ✅ FRAME
    if (product.model || product.size) {
      line1 = product.brand || "";
      line2 = product.model || "";
      line3 = [
        product.color,
        product.size ? `${product.size}` : ""
      ].filter(Boolean).join(" | ");
    }

    // ✅ LENS
    else if (product.lensType || product.lensIndex) {
      line1 = product.brand || "";
      line2 = product.name || "";
      line3 = [
        product.lensType,
        product.lensIndex || ""
      ].filter(Boolean).join(" | ");
    }

    // ✅ ACCESSORY
    else {
      line1 = product.name || "";
      line2 = product.category || "";
      line3 = "";
    }

    let labelsHtml = "";
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
      <div class="label">
        <div class="barcode-section">${barcodeSvg}</div>
        <div class="details-section">

          <div class="heading">${escapeHtml(line1)}</div>

          ${line2 ? `<div class="subheading">${escapeHtml(line2)}</div>` : ""}

          ${line3 ? `<div class="subheading">${escapeHtml(line3)}</div>` : ""}

          <div class="price">${escapeHtml(price)}</div>

        </div>
      </div>
    `;
    }

    printLabels(labelsHtml);
  };

  return (
    <button onClick={handlePrint} className={className}>
      Print Label
    </button>
  );
}