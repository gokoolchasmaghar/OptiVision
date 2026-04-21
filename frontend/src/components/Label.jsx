import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";


// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT HELPER (THERMAL ROLL MODE - MULTIPLE LABELS)
// ─────────────────────────────────────────────────────────────
export function printLabels(labelHtml) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    alert("Please allow popups to print labels.");
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Print Labels</title>

      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: Arial, sans-serif;
          background: #fff;
        }

        /* Container = roll width */
        .container {
          width: 58mm;
          margin: 0 auto;
        }

        /* Each label */
        .label {
          width: 100%;
          height: 25mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2mm;
          font-size: 10px;

          gap: 5mm;
        }

        .left {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .bold { font-weight: 700; }

        .right {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .barcode-text {
          font-size: 8px;
        }

        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
          }

          body {
            margin: 0;
          }

          .label {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>

    <body>
      <div class="container">
        ${labelHtml}
      </div>

      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
            window.close();
          }, 400);
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
      width: 1.2,
      height: 30,
      displayValue: true,
      fontSize: 8,
      margin: 0,
    });

    return svg.outerHTML;
  } catch (e) {
    console.error("Barcode error:", e);
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
      width: 1.2,
      height: 35,
      displayValue: true,
      fontSize: 12,
      margin: 0,
    });
  }, [product]);

  if (!product) return null;

  return (
    <div style={{ padding: 10 }}>
      <div
        style={{
          width: 400,
          height: 80,
          border: "1px solid #ccc",
          display: "flex",
          padding: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold" }}>
            {product.brand} {product.model}
          </div>
          <div style={{ fontSize: 12 }}>{product.color}</div>
          <div style={{ fontSize: 12 }}>
            ₹{product.sellingPrice}
          </div>
        </div>

        <div>
          <svg ref={ref}></svg>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// 🖨️ PRINT BUTTON (MULTI-LABEL SUPPORT)
// ─────────────────────────────────────────────────────────────
export function PrintLabelButton({ product, quantity = 1, className = "" }) {
  const handlePrint = () => {
    if (!product) return;

    const isLens = !!product.lensType;

    const line1 = isLens
      ? `${product.name || ""} ${product.brand || ""}`
      : `${product.brand || ""} ${product.model || ""}`;

    const line2 = isLens
      ? `${product.lensType || ""} ${product.lensIndex || ""}`
      : `${product.color || ""} ${product.size ? `Size ${product.size}` : ""}`;

    const price = `₹${Number(product.sellingPrice || 0).toLocaleString("en-IN")}`;

    const barcode = buildBarcodeSvg(product.barcode);

    let labelsHtml = "";

    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label">
          
          <div class="left">
            <div class="bold">${line1}</div>
            <div>${line2}</div>
            <div class="bold">${price}</div>
          </div>

          <div class="right">
            ${barcode}
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