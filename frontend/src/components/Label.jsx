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
          width: 100mm;   /* full roll width — needed for margin:auto to centre the 70mm container */
        }

        /*
          TVS LP 46 Dlite:
            Physical roll width : 100mm
            Printable width     : ~70mm (hardware margin ~4mm each side)
            Label height        : 20mm

          ⚠️ NOTE: @page size is a CSS hint only.
          Thermal drivers (TVS LP 46 Dlite) ignore it and use the paper size
          set in Windows → Devices & Printers → Printing Preferences → Paper Size.
          Make sure that is set to 100mm × 20mm (or your label stock size).
        */
        @media print {
          @page {
            size: 70mm 20mm;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 70mm;
            height: 20mm;
          }
          .container {
            margin: 0;
          }
        }

        .container {
          width: 70mm;
          margin: 0 auto;
        }

        /* One label per physical label — force a page break after each */
        .label {
          width: 70mm;
          height: 20mm;
          margin: 0;
          padding: 0;

          display: flex;
          align-items: stretch;
          justify-content: flex-start;

          box-sizing: border-box;
          overflow: hidden;

          /* Each label on its own page */
          break-after: page;
          page-break-after: always;
          break-inside: avoid;
        }

        /* Left: Barcode Area — 50% for exact fold */
        .barcode-section {
          width: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1mm 1.5mm 1mm 1mm;
          border-right: 1.5px dashed #555;
          overflow: hidden;
          box-sizing: border-box;
        }

        .barcode-section svg {
          max-width: 100%;
          height: auto;
        }

        /* Right: Info Area — 50% for exact fold */
        .details-section {
          width: 50%;
          padding: 1mm 1mm 1mm 2.5mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          line-height: 1.2;
          overflow: hidden;
          box-sizing: border-box;
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
      // FIX: reduced from 1.0 → 0.8 so long barcodes (13+ digits) fit within 56% of 70mm
      // At width:1.0 a 13-digit CODE128 is ~160px wide but the container is only ~113px
      width: 0.8,
      height: 18,
      textMargin: 0,
      margin: 2,
      displayValue: true,
      fontSize: 8,
    });

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

    JsBarcode(ref.current, product.barcode, {
      format: "CODE128",
      // FIX: match buildBarcodeSvg — width:0.8 so preview matches print
      width: 0.8,
      height: 18,
      textMargin: 0,
      margin: 2,
      displayValue: true,
      fontSize: 8,
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
            flex: "0 0 56%",
            maxWidth: "56%",
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
            }}
          />
        </div>

        {/* Details column */}
        <div
          style={{
            flex: "0 0 44%",
            maxWidth: "44%",
            /* FIX: removed marginLeft — was doubling up with paddingLeft */
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