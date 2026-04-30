import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import toast from "react-hot-toast";

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
          transform: rotate(0deg);
        }

        svg {
          width: 95%;
          height: auto;
        }

        .container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .label {
          width: 70mm;
          height: 20mm;
          margin: 0;

          display: flex;
          align-items: center;
          justify-content: space-between;

          box-sizing: border-box;
          padding: 0.8mm 0;

          overflow: hidden;
        }

        /* Left: Barcode Area */
        .barcode-section {
          width: 58%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5mm 1mm 0.5mm 0;
          border-right: 1px dashed #666;
        }

        /* Right: Info Area */
        .details-section {
          width: 42%;
          padding-left: 2mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          line-height: 1.1;
        }

        .heading { font-weight: bold; font-size: 11px; }
        .subheading { font-size: 10px; }
        .price { font-weight: bold; font-size: 11px; margin-top: 1mm; }

        @media print {
          @page {
            size: 100mm 20mm;
            margin: 0;
          }
          body { margin: 0; }
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
      width: 1.5,
      height: 34,
      textMargin: 2,
      displayValue: true,
      fontSize: 8,
      margin: 0,
    });

    // force inline size for print consistency
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

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
      width: 1.5,
      height: 34,
      textMargin: 2,
      displayValue: true,
      fontSize: 8,
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