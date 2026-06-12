import { format } from 'date-fns';
import api from '../services/api';
import toast from 'react-hot-toast';
import bwipjs from 'bwip-js';

// ----------------------
// 🔹 Helpers
// ----------------------
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// -----------------------
// 🔹 Fetch Invoice Blob
// -----------------------
export const fetchInvoiceBlob = async (orderId) => {
  const res = await api.get(`/orders/${orderId}/invoice`, {
    responseType: 'blob',
  });
  return res.data;
};

// ----------------------
// 🔹 Download Invoice
// ----------------------
export const downloadInvoice = async (order) => {
  try {
    const blob = await fetchInvoiceBlob(order.id);

    const url = window.URL.createObjectURL(
      new Blob([blob], { type: 'application/pdf' })
    );

    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${order.orderNumber}.pdf`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    toast.error('Download failed');
  }
};

// ----------------------
// 🔹 Print Invoice
// ----------------------
export const printInvoice = (order) => {
  try {
    const win = window.open('', '_blank');

    if (!win) {
      toast.error('Popup blocked!');
      return;
    }

    const html = generateInvoiceHTML(order);

    win.document.open();
    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  } catch (err) {
    console.error(err);
    toast.error('Print failed');
  }
};

// ----------------------
// 🔹 WhatsApp Share
// ----------------------
export const shareOnWhatsApp = (order) => {
  const phone = String(order.customer?.phone || '').replace(/[^\d]/g, '');

  if (!phone) {
    toast.error('Customer phone missing');
    return;
  }

  // const invoiceUrl = `${window.location.origin}/api/orders/${order.id}/invoice`;
  const invoiceUrl = `${import.meta.env.VITE_API_URL}/orders/public/${order.id}/invoice`;

  const message = `🧾 *Invoice: ${order.orderNumber}*
    👤 ${order.customer?.name}
    💰 Total: ${fmt(Math.round(Number(order.totalAmount || 0)))}

    📥 Download Invoice:
    ${invoiceUrl}

    Thank you for choosing us!`;

  window.open(
    `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`,
    '_blank'
  );
};

const numberToWords = num => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five',
    'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
    'Nineteen'
  ];

  const b = [
    '', '', 'Twenty', 'Thirty', 'Forty',
    'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const inWords = n => {
    if (n < 20) return a[n];
    if (n < 100)
      return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000)
      return a[Math.floor(n / 100)] +
        ' Hundred' +
        (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000)
      return inWords(Math.floor(n / 1000)) +
        ' Thousand' +
        (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000)
      return inWords(Math.floor(n / 100000)) +
        ' Lakh' +
        (n % 100000 ? ' ' + inWords(n % 100000) : '');

    return inWords(Math.floor(n / 10000000)) +
      ' Crore' +
      (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };

  return `INR ${inWords(num)} only`;
};

const generateInvoiceHTML = (order) => {
  // ----------------------
  // 🔥 Apply same logic as backend
  // ----------------------
  const itemGross = item => Number(item.unitPrice || 0) * Number(item.quantity || 0);
  const itemDiscount = item => Number(item.discountAmount ?? (
    itemGross(item) * Math.max(0, Number(item.discountPct || 0)) / 100
  ));
  const itemPayable = item => itemGross(item)
    + (item.rateInclusiveOfGst ? 0 : Number(item.gstAmount || 0))
    - itemDiscount(item);
  const subtotal = order.items.reduce((sum, item) => sum + itemPayable(item), 0);

  const itemsTotal = subtotal;

  const totalTaxableValue = order.items.reduce(
    (sum, item) => sum + Number(item.taxableValue || 0),
    0
  );

  const totalGSTAmount = order.items.reduce(
    (sum, item) => sum + Number(item.gstAmount || 0),
    0
  );

  const roundedGrandTotal = Math.round(Number(order.totalAmount || 0));

  let barcodeImg = '';
  try {
    const canvas = document.createElement('canvas');

    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text: order.orderNumber,
      scale: 3,
      height: 10,
      includetext: false,
    });

    barcodeImg = canvas.toDataURL('image/png');
  } catch (e) {
    console.error(e);
  }

  const rx = order.prescription || {};

  // ----------------------
  // 🔥 Rows
  // ----------------------
  const rows = order.items.map((i) => `
    <tr>
      <td class="left">${i.name}</td>
      <td>${Number(i.gstRate || 0).toFixed(2)}%<br/>HSN ${i.hsn || '-'}</td>
      <td>${i.quantity}</td>
      <td>${fmt(i.unitPrice)}</td>
      <td>${Number(i.discountPct || 0).toFixed(2)}%</td>
      <td>${fmt(Math.round(itemPayable(i)))}</td>
    </tr>
  `).join('');

  // Calculate GST by rate
  const formatPower = (val) => {
    if (val === null || val === undefined) return "0.00";
    return Number(val).toFixed(2);
  };

  const formatPD = (val) => {
    if (val === null || val === undefined || isNaN(val)) return "-";
    return Number(val).toFixed(0);
  };

  // ----------------------
  // 🔥 HTML
  // ----------------------
  return `
  <html>
  <head>
    <style>
      @page {
          size: A4;
          margin: 8mm;
      }
          
      body { font-family: Arial; padding: 20px; color:#000; font-size:11px; }

      .header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
      }

      .title { font-size:22px; font-weight:bold }

      .section { margin-top:10px }

      table {
        width:100%;
        border-collapse: collapse;
        margin-top:10px;
      }

      th, td {
        border:1px solid #000;
        padding:4px;
        text-align:center;
        font-size:12px;
      }

      th { background:#f5f5f5 }

      .left { text-align:left }
      .right { text-align:right }

      .bold { font-weight:bold }

      .footer {
        margin-top:12px;
        text-align:center;
        font-size:11px;
      }
    </style>
  </head>

  <body>

    <!-- HEADER -->
    <div class="header">
      <div>
        <div class="title">${order.store?.name || 'GO-KOOL CHASMAGHAR'}</div>
        <div>${order.store?.address || '235, Parbirata G.T. Road, Sripally'}</div>
        ${order.store?.gstNumber ? `<div>GSTIN: ${order.store.gstNumber}</div>` : ''}
        <div>Phone: ${order.store?.phone || '+91 9832906048'}</div>
      </div>

      <div style="text-align:right">
        <img src="${barcodeImg}" style="height:60px;" />
        <div style="margin-top:6px; font-weight:bold;">
          ${order.orderNumber}
        </div>
      </div>
    </div>

    <!-- INFO -->
    <div class="section" style="display:flex; justify-content:space-between;">
    <div><b>Invoice No:</b> ${order.orderNumber}</div>

    <div style="text-align:right">
      <div><b>Date:</b> ${format(new Date(order.createdAt), 'dd-MMM-yyyy')}</div>
      <div><b>Delivery Date:</b> ${order.deliveryDate
      ? format(new Date(order.deliveryDate), 'dd-MMM-yyyy')
      : 'Pending'
    }</div>
    </div>
  </div>

    <!-- CUSTOMER -->
    <div class="section">
      <b>Customer Name:</b> ${order.customer?.name || '-'}<br/>
      <b>Mobile:</b> ${order.customer?.phone || '-'}
    </div>

    <!-- EYE -->
    ${order.prescription ? `
        <div class="section">
          <h3>Customer Eye Power</h3>
          <table>
            <tr>
              <th></th>
              <th>Right Eye</th>
              <th>Left Eye</th>
            </tr>

            <tr>
              <td>SPH</td>
              <td>${formatPower(rx.rightSph)}</td>
              <td>${formatPower(rx.leftSph)}</td>
            </tr>

            <tr>
              <td>CYL</td>
              <td>${formatPower(rx.rightCyl)}</td>
              <td>${formatPower(rx.leftCyl)}</td>
            </tr>

            <tr>
              <td>AXIS</td>
              <td>${rx.rightAxis ?? '0.00'}</td>
              <td>${rx.leftAxis ?? '0.00'}</td>
            </tr>

            <tr>
              <td>ADD</td>
              <td>${formatPower(rx.rightAdd)}</td>
              <td>${formatPower(rx.leftAdd)}</td>
            </tr>
          </table>

          <div style="margin-top:10px;">
            <b>PD (mm):</b> ${formatPD(rx.pd)}
          </div>

          <div style="margin-top:4px;">
            <b>Lens Type:</b> ${rx.lensType
        ? rx.lensType.replace('_', ' ')
        : 'NULL'
      }
          </div>
        </div>
      ` : ''}

    <!-- PRODUCTS -->
    <div class="section">
      <h3>Product Details</h3>
      <table>
        <tr>
          <th class="left">Product</th>
            <th>GST (HSN)</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Discount</th>
            <th>Total</th>
        </tr>
        ${rows}
      </table>
    </div>

    <div style="
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      margin-top:15px;
    ">

      <!-- Other Details -->
      <div style="
        width:55%;
        font-size:12px;
      ">

        Amount In Words:<br/>
        <b>${numberToWords(roundedGrandTotal)}</b> <br/><br/>

        <b>Bank Details</b><br/>
        Bank Name : Bank of Baroda<br/>
        Account Name : GO KOOL CHASMAGHAR<br/>
        A/C No : 09060200000927<br/>
        IFSC Code : BARB0BURDWA<br/>
        Branch : Burdwan Branch, West Bengal
      </div>

      <!-- Summary -->
      <div style="width:300px;">
        <table>
          <tr>
            <td class="left">Items Total</td>
            <td class="right">${fmt(itemsTotal)}</td>
          </tr>

          <tr>
            <td class="left">Taxable Value</td>
            <td class="right">${fmt(totalTaxableValue)}</td>
          </tr>

          <tr>
            <td class="left">GST Amount</td>
            <td class="right">${fmt(totalGSTAmount)}</td>
          </tr>

          ${Number(order.discountAmount || 0) > 0 ? `
          <tr>
            <td class="left">Bill Discount</td>
            <td class="right">-${fmt(order.discountAmount)}</td>
          </tr>
          ` : ''}

          ${Number(order.redeemPoints || 0) > 0 ? `
          <tr>
            <td class="left">Loyalty Redeemed</td>
            <td class="right">-${fmt(order.redeemPoints)}</td>
          </tr>
          ` : ''}

          <tr>
            <td class="left bold">Grand Total</td>
            <td class="right bold"> ${fmt(roundedGrandTotal)}</td>
          </tr>

          <tr>
            <td class="left">Advance Paid</td>
            <td class="right">${fmt(order.advanceAmount)}</td>
          </tr>

          <tr>
            <td class="left bold">Balance</td>
            <td class="right bold">
              ${fmt(Math.round(Number(order.balanceAmount || 0)))}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div style="margin-top:15px;">
      <b>Warranty Details</b>

      <p style="font-size:12px; margin-top:5px;">
        All products come with a standard warranty of 1 year from the date of purchase. The warranty covers manufacturing defects and does not cover damage caused by misuse, accidents, or unauthorized repairs. Please retain your invoice as proof of purchase for any warranty claims.
      </p>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <b>Thank You for Shopping with Us!</b><br/>
        We look forward to serving you again.
    </div>

  </body>
  </html>
  `;
};
