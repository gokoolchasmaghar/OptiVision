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
    💰 Total: ${fmt(order.totalAmount)}

    📥 Download Invoice:
    ${invoiceUrl}

    Thank you for choosing us!`;

  window.open(
    `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`,
    '_blank'
  );
};

const generateInvoiceHTML = (order) => {
  // ----------------------
  // 🔥 Apply same logic as backend
  // ----------------------
  const subtotal = order.items.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );

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

  let remainingDiscount = Number(order.discountAmount || 0);
  const itemsWithDiscount = order.items.map((item, index) => {
    const itemTotal = Number(item.totalPrice || 0);
    const ratio = subtotal > 0 ? itemTotal / subtotal : 0;

    let discountAmount = Number((ratio * remainingDiscount).toFixed(2));
    if (index === order.items.length - 1) {
      discountAmount = Number(remainingDiscount.toFixed(2));
    }

    remainingDiscount -= discountAmount;
    const discountPct =
      itemTotal > 0 ? (discountAmount / itemTotal) * 100 : 0;

    return {
      ...item,
      discountAmount,
      discountPct,
      finalPrice: itemTotal - discountAmount,
    };
  });

  const subtotalAfterDiscount = itemsWithDiscount.reduce(
    (sum, i) => sum + Number(i.finalPrice || 0),
    0
  );

  const rx = order.prescription || {};

  // ----------------------
  // 🔥 Rows
  // ----------------------
  const rows = itemsWithDiscount.map((i) => `
    <tr>
      <td class="left">${i.name}</td>
      <td>${i.quantity}</td>
      <td>${fmt(i.unitPrice)}</td>
      <td>${Number(i.discountPct.toFixed(1))}%</td>
      <td>${fmt(i.finalPrice)}</td>
    </tr>
  `).join('');

  // ----------------------
  // 🔥 HTML
  // ----------------------
  return `
  <html>
  <head>
    <style>
      body { font-family: Arial; padding: 24px; color:#000 }

      .header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
      }

      .title { font-size:28px; font-weight:bold }

      .section { margin-top:18px }

      table {
        width:100%;
        border-collapse: collapse;
        margin-top:10px;
      }

      th, td {
        border:1px solid #000;
        padding:8px;
        text-align:center;
      }

      th { background:#f5f5f5 }

      .left { text-align:left }
      .right { text-align:right }

      .summary {
        width:280px;
        margin-left:auto;
        margin-top:15px;
      }

      .bold { font-weight:bold }

      .footer {
        margin-top:30px;
        text-align:center;
      }
    </style>
  </head>

  <body>

    <!-- HEADER -->
    <div class="header">
      <div>
        <div class="title">GO-KOOL CHASMAGHAR</div>
        <div>235, Parbirata G.T. Road, Sripally  </div>
        <div>Near State Bank of India </div>
        <div>Burdwan, Purba Bardhaman </div>
        <div>West Bengal - 713103</div>
        <div>Phone: +91 9832906048</div>
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
      <div><b>Date:</b> ${format(new Date(order.createdAt), 'dd-MMM-yyyy')}</div>
    </div>

    <!-- CUSTOMER -->
    <div class="section">
      <b>Customer Name:</b> ${order.customer?.name || '-'}<br/>
      <b>Mobile:</b> ${order.customer?.phone || '-'}
    </div>

    <!-- EYE -->
    <div class="section">
      <h3>Customer Eye Power</h3>
      <table>
        <tr>
          <th>Eye</th>
          <th>Sphere</th>
          <th>Cylinder</th>
          <th>Axis</th>
        </tr>
        <tr>
          <td>RE</td>
          <td>${rx.rightSph || '-'}</td>
          <td>${rx.rightCyl || '-'}</td>
          <td>${rx.rightAxis || '-'}</td>
        </tr>
        <tr>
          <td>LE</td>
          <td>${rx.leftSph || '-'}</td>
          <td>${rx.leftCyl || '-'}</td>
          <td>${rx.leftAxis || '-'}</td>
        </tr>
      </table>
    </div>

    <!-- PRODUCTS -->
    <div class="section">
      <h3>Product Details</h3>
      <table>
        <tr>
          <th class="left">Product</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Discount</th>
          <th>Total</th>
        </tr>
        ${rows}
      </table>
    </div>

    <!-- SUMMARY -->
    <div class="summary">
      <table>
        <tr>
          <td class="left">Items Total</td>
          <td class="right">${fmt(subtotalAfterDiscount)}</td>
        </tr>

        <tr>
          <td class="left">Loyalty Redeemed</td>
          <td class="right">−${fmt(order.redeemPoints)}</td>
        </tr>

        <tr>
          <td class="left">GST (Included)</td>
          <td class="right">${fmt(order.taxAmount)}</td>
        </tr>

        <tr>
          <td class="left bold">Total Payable</td>
          <td class="right bold">${fmt(order.totalAmount)}</td>
        </tr>

        <tr>
          <td class="left">Advance Paid</td>
          <td class="right">${fmt(order.advanceAmount)}</td>
        </tr>

        <tr>
          <td class="left bold">Balance</td>
          <td class="right bold">${fmt(order.balanceAmount)}</td>
        </tr>
      </table>
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