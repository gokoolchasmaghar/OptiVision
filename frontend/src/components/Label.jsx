import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT HELPER (FRAME TAG LAYOUT)
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: sans-serif; 
          background: #fff; 
          transform: rotate(0deg);
        }

        .container {
          width: 100%; 
          margin: 5mm auto;
        }

        .label {
          width: 60mm; /* Narrower for optical frame tags */
          height: 30mm;
          border: 0.5pt solid #000;
          border-radius: 6px;
          display: table;
          table-layout: fixed;
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 4mm;
          overflow: hidden;
          page-break-inside: avoid;
        }

        /* Left: Barcode Area */
        .barcode-section {
          display: table-cell;
          width: 55%;
          vertical-align: middle;
          text-align: center;
          padding: 1mm;
          border-right: 1px dashed #666; /* Perforation line */
        }

        /* Right: Info Area */
        .details-section {
          display: table-cell;
          width: 45%;
          vertical-align: middle;
          padding-left: 2mm;
          line-height: 1.2;
        }

        .heading { font-weight: bold; font-size: 11px; }
        .subheading { font-size: 10px; }
        .price { font-weight: bold; font-size: 11px; margin-top: 1mm; }

        @media print {
          @page {
            size: 60mm 30mm; /* adjust based on your roll */
            margin: 0;
          }
          body { margin: 0; }
          .label { border: 0.5pt solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="container">${labelHtml}</div>
      <script>
        window.onload = function () {
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.close();
            }, 800);
          };
        };
      </script>
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
      width: 2,
      height: 40,
      displayValue: true,
      fontSize: 9,
      margin: 0,
    });
    return svg.outerHTML;
  } catch (e) {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────
// 🧩 PREVIEW COMPONENT (UI)
// ─────────────────────────────────────────────────────────────
export default function Label({ product }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    ref.current.innerHTML = ""; //CLEAR OLD SVG

    if (!product?.barcode) return;

    JsBarcode(ref.current, product.barcode, {
      format: "CODE128",
      width: 1.3,
      height: 42,
      displayValue: true,
      fontSize: 10,
      margin: 0,
    });
  }, [product]);

  if (!product) return null;

  return (
    <div style={{ padding: "10px" }}>
      <div style={{
        width: "100%",
        maxWidth: "360px",
        aspectRatio: "3.5 / 1",
        height: "80px",
        border: "1px solid #000",
        borderRadius: "8px",
        display: "flex",
        background: "#fff"
      }}>
        <div
          style={{
            flex: "0 0 55%",
            maxWidth: "55%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: "1px dashed #ccc",
            overflow: "hidden",
          }}
        >
          <svg
            ref={ref}
            style={{
              width: "85%",
              height: "auto",
              maxHeight: "60px",
            }}
          />
        </div>
        <div
          style={{
            flex: "0 0 45%",
            maxWidth: "45%",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div style={{
            fontWeight: "bold",
            fontSize: "12px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {product.brand}
          </div>

          <div style={{
            fontSize: "11px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            {product.model || product.name || ""}
          </div>

          <div style={{ fontSize: "10px" }}>
            {[product.color, product.size].filter(Boolean).join(" | ")}
          </div>

          <div style={{
            fontWeight: "bold",
            fontSize: "clamp(10px, 2.5vw, 12px)",
            marginTop: "2px"
          }}>
            ₹{product.sellingPrice}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT BUTTON
// ─────────────────────────────────────────────────────────────
export function PrintLabelButton({ product, quantity = 1, className = "" }) {
  const handlePrint = () => {
    if (!product) return;

    const barcodeSvg = buildBarcodeSvg(product.barcode);
    const heading = `${product.brand || ""} ${product.model || ""}`;
    const subHeading = `${product.color || ""} ${product.size ? `Size: ${product.size}` : ""}`;
    const price = `₹${Number(product.sellingPrice || 0).toLocaleString("en-IN")}`;

    let labelsHtml = "";
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label">
          <div class="barcode-section">${barcodeSvg}</div>
          <div class="details-section">
            <div class="heading">${heading}</div>
            <div class="subheading">${subHeading}</div>
            <div class="price">${price}</div>
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