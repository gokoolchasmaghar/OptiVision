const bwipjs = require('bwip-js');
const prisma = require('../utils/prisma');
const { applyDiscount } = require('../utils/calculatePay');
const { launchPdfBrowser } = require('../utils/pdfBrowser');

const fmt = n => `&#8377;${Number(n || 0).toLocaleString('en-IN')}`;

const ORDER_INCLUDE = {
  customer: true,
  items: true,
  payments: true,
  prescription: true,
};

const formatPower = val => {
  if (val === null || val === undefined) return '0.00';
  return Number(val).toFixed(2);
};

const formatPD = val => {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '-';
  return Number(val).toFixed(0);
};

const getDiscountedItems = order => {
  const subtotal = Number(order.subtotal || 0) || order.items.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );

  return applyDiscount({
    ...order,
    subtotal,
  });
};

const buildInvoiceHtml = (order, barcodeImg = '') => {
  const rx = order.prescription || {};
  const itemsWithDiscount = getDiscountedItems(order);
  const subtotalAfterDiscount = itemsWithDiscount.reduce(
    (sum, i) => sum + Number(i.finalPrice || 0),
    0
  );

  const itemRows = itemsWithDiscount.map(i => `
    <tr>
      <td class="left">${i.name}</td>
      <td>${i.quantity}</td>
      <td>${fmt(i.unitPrice)}</td>
      <td>${i.appliedDiscountPct.toFixed(2)}%</td>
      <td>${fmt(i.finalPrice)}</td>
    </tr>
  `).join('');

  return `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 24px; color: #000; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .title { font-size: 28px; font-weight: bold; }
        .section { margin-top: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: center; }
        th { background: #f5f5f5; }
        .left { text-align: left; }
        .right { text-align: right; }
        .summary { width: 280px; margin-left: auto; margin-top: 15px; }
        .bold { font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; }
      </style>
    </head>

    <body>
      <div class="header">
        <div>
          <div class="title">GO-KOOL CHASMAGHAR</div>
          <div>235, Parbirata G.T. Road, Sripally</div>
          <div>Near State Bank of India</div>
          <div>Burdwan, Purba Bardhaman</div>
          <div>West Bengal - 713103</div>
          <div>Phone: +91 9832906048</div>
        </div>
        <div style="text-align:right">
          ${barcodeImg ? `<img src="${barcodeImg}" style="height:70px;" />` : ''}
          <div style="margin-top:6px; font-weight:bold;">
            ${order.orderNumber}
          </div>
        </div>
      </div>

      <div class="section" style="display:flex; justify-content:space-between;">
        <div><b>Invoice No:</b> ${order.orderNumber}</div>

        <div style="text-align:right">
          <div><b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}</div>
          <div><b>Delivery Date:</b> ${
            order.deliveryDate
              ? new Date(order.deliveryDate).toLocaleDateString()
              : 'Pending'
          }</div>
        </div>
      </div>

      <!-- CUSTOMER -->
      <div class="section">
        <b>Customer Name:</b> ${order.customer?.name || '-'}<br/>
        <b>Mobile:</b> ${order.customer?.phone || '-'}
      </div>

      ${order.prescription ? `
        <div class="section">
          <h3>Customer Eye Power</h3>
          <table>
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
            <b>Lens Type:</b> ${
              rx.lensType
                ? rx.lensType.replace('_', ' ')
                : 'NULL'
            }
          </div>
        </div>
      ` : ''}
      

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
          ${itemRows}
        </table>
      </div>

      <div class="summary">
        <table>
          <tr>
            <td class="left">Items Total</td>
            <td class="right">${fmt(subtotalAfterDiscount)}</td>
          </tr>
          <tr>
            <td class="left">Loyalty Redeemed</td>
            <td class="right">-${fmt(order.redeemPoints)}</td>
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

      <div class="footer">
        <b>Thank You for Shopping with Us!</b><br/>
        We look forward to serving you again.
      </div>
    </body>
    </html>
  `;
};

const htmlToPdf = async html => {
  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
};

const makeBarcodeDataUrl = async text => {
  const barcodeBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 12,
    includetext: false,
  });

  return `data:image/png;base64,${barcodeBuffer.toString('base64')}`;
};

const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, storeId: req.storeId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const barcodeImg = await makeBarcodeDataUrl(order.orderNumber);
    const html = buildInvoiceHtml(order, barcodeImg);
    const pdf = await htmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    res.setHeader('Content-Length', pdf.length);

    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Invoice generation failed' });
  }
};

const generatePublicInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      return res.status(404).send('Invoice not found');
    }

    const html = buildInvoiceHtml(order);
    const pdf = await htmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=invoice-${order.orderNumber}.pdf`);
    res.setHeader('Content-Length', pdf.length);

    return res.end(pdf);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Invoice generation failed');
  }
};

module.exports = {
  generateInvoice,
  generatePublicInvoice,
};
