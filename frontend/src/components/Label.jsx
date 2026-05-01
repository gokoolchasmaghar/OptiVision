import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT HELPER (FIXED FOR THERMAL PRINTER)
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
          width: 100mm;
          background: #fff;
        }

        @media print {
          @page {
            size: 100mm 20mm; /* MUST match printer */
            margin: 0;
          }

          html, body {
            width: 100mm;
            margin: 0;
            padding: 0;
          }

          .container {
            width: 70mm;
            margin-left: 0; /* ❗ critical fix */
          }
        }

        .container {
          width: 70mm;
        }

        .label {
          width: 70mm;
          height: 20mm;
          position: relative;
          overflow: hidden;

          page-break-inside: avoid;
        }
         
        .label:not(:last-child) {
          page-break-after: always;
          break-after: page;
        }

        /* 🔹 FOLD GUIDE (center) */
        .label::after {
          content: "";
          position: absolute;
          left: calc(35mm - 0.5mm);
          top: 4mm;
          bottom: 4mm;

          border-left: 1px dashed #888;   /* lighter = better for manual fold */
        }

        /* 🔹 LEFT: BARCODE */
        .barcode-section {
          position: absolute;
          left: 0;
          width: 35mm;
          height: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          padding-right: 2.5mm;   /* 👈 more breathing space */
          box-sizing: border-box;
        }

        .barcode-section svg {
          max-width: 100%;
          height: auto;
          display: block;
          margin: auto;
        }

        /* RIGHT DETAILS */
        .details-section {
          position: absolute;
          left: 35mm;
          width: 35mm;
          height: 100%;

          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;

          padding: 0 2mm;          
          text-align: center;

          box-sizing: border-box;
          line-height: 1.1;
        }

        .heading {
          font-weight: bold;
          font-size: 9.5px;
          line-height: 1.1;

          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .subheading {
          font-size: 8.5px;
          line-height: 1.1;

          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .heading,
        .subheading,
        .price {
          width: 100%;
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
          }, 250);
        };
      <\/script>
    </body>
    </html>
  `);

  win.document.close();
}

// ─────────────────────────────────────────────────────────────
// 🔢 BARCODE GENERATOR (BALANCED)
// ─────────────────────────────────────────────────────────────
function buildBarcodeSvg(barcode) {
  if (!barcode) return "";

  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    JsBarcode(svg, barcode, {
      format: "CODE128",
      width: 0.8,
      height: 15,        // ✅ balanced height
      margin: 0,         // ✅ removes vertical shift
      textMargin: 0,
      displayValue: true,
      fontSize: 8,
    });

    return svg.outerHTML;
  } catch (e) {
    console.error(e);
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 🧩 PREVIEW COMPONENT (MATCHES PRINT)
// ─────────────────────────────────────────────────────────────
export default function Label({ product }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !product?.barcode) return;

    JsBarcode(ref.current, product.barcode, {
      format: "CODE128",
      width: 0.8,
      height: 15,
      margin: 0,
      textMargin: 0,
      displayValue: true,
      fontSize: 8,
    });
  }, [product]);

  if (!product) return null;

  return (
    <div style={{ padding: "10px" }}>
      <div
        style={{
          width: "280px",
          height: "80px",
          display: "flex",
          background: "#fff",
          border: "1px solid #ccc",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "0 0 50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: "1px dashed #ccc",
            padding: "4px",
          }}
        >
          <svg ref={ref} style={{ maxWidth: "100%", maxHeight: "64px" }} />
        </div>

        <div
          style={{
            flex: "0 0 50%",
            padding: "4px 6px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>
            {product.brand}
          </div>

          <div style={{ fontSize: "11px" }}>
            {product.name || product.model || ""}
          </div>

          <div style={{ fontSize: "10px" }}>
            {[product.color, product.size].filter(Boolean).join(" | ")}
          </div>

          <div style={{ fontWeight: "bold", fontSize: "12px" }}>
            ₹{Number(product.sellingPrice || 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 🛡️ SANITIZER
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

    let line1 = product.brand || "";
    let line2 = product.model || product.name || "";
    let line3 = [product.color, product.size].filter(Boolean).join(" | ");

    let html = "";

    for (let i = 0; i < quantity; i++) {
      html += `
        <div class="label">
          <div class="barcode-section">${barcodeSvg}</div>
          <div class="details-section">
            <div class="heading">${escapeHtml(line1)}</div>
            ${line2 ? `<div class="subheading">${escapeHtml(line2)}</div>` : ""}
            ${line3 ? `<div class="subheading">${escapeHtml(line3)}</div>` : ""}
            <div class="price">${price}</div>
          </div>
        </div>
      `;
    }

    printLabels(html);
  };

  return (
    <button onClick={handlePrint} className={className}>
      Print Label
    </button>
  );
}