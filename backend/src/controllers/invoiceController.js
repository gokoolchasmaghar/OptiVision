const bwipjs = require('bwip-js');
const prisma = require('../utils/prisma');
const { launchPdfBrowser } = require('../utils/pdfBrowser');
const { format } = require('date-fns');

const fmt = n => `&#8377;${Number(n || 0).toLocaleString('en-IN')}`;

const ORDER_INCLUDE = {
  customer: true,
  items: true,
  payments: true,
  prescription: true,
  store: true,
};

const formatPower = val => {
  if (val === null || val === undefined) return '0.00';
  return Number(val).toFixed(2);
};

const formatPD = val => {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '-';
  return Number(val).toFixed(0);
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
      return (
        a[Math.floor(n / 100)] +
        ' Hundred' +
        (n % 100 ? ' ' + inWords(n % 100) : '')
      );
    if (n < 100000)
      return (
        inWords(Math.floor(n / 1000)) +
        ' Thousand' +
        (n % 1000 ? ' ' + inWords(n % 1000) : '')
      );
    if (n < 10000000)
      return (
        inWords(Math.floor(n / 100000)) +
        ' Lakh' +
        (n % 100000 ? ' ' + inWords(n % 100000) : '')
      );

    return (
      inWords(Math.floor(n / 10000000)) +
      ' Crore' +
      (n % 10000000 ? ' ' + inWords(n % 10000000) : '')
    );
  };

  return `INR ${inWords(num)} Only`;
};

const buildInvoiceHtml = (order, barcodeImg = '') => {
  const rx = order.prescription || {};
  const itemGross = item => Number(item.unitPrice || 0) * Number(item.quantity || 0);
  const itemDiscount = item => Number(item.discountAmount ?? (
    itemGross(item) * Math.max(0, Number(item.discountPct || 0)) / 100
  ));
  const itemPayable = item => itemGross(item)
    + (item.rateInclusiveOfGst ? 0 : Number(item.gstAmount || 0))
    - itemDiscount(item);
  const itemsTotal = order.items.reduce((sum, item) => sum + itemPayable(item), 0);

  const totalTaxableValue = order.items.reduce(
    (sum, item) => sum + Number(item.taxableValue || 0),
    0
  );

  const totalGSTAmount = order.items.reduce(
    (sum, item) => sum + Number(item.gstAmount || 0),
    0
  );

  const roundedGrandTotal = Math.round(Number(order.totalAmount || 0));

  const itemRows = order.items.map(i => `
    <tr>
      <td class="left">${i.name}</td>
      <td>${Number(i.gstRate || 0).toFixed(2)}%<br/>HSN ${i.hsn || '-'}</td>
      <td>${i.quantity}</td>
      <td>${fmt(i.unitPrice)}</td>
      <td>${Number(i.discountPct || 0).toFixed(2)}%</td>
      <td>${fmt(Math.round(itemPayable(i)))}</td>
    </tr>
    `).join('');

  return `
    <html>
    <head>
      <style>
        @page {
          size: A4;
          margin: 8mm;
        }
    
        body { font-family: Arial; padding: 20px; color: #000; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .title { font-size: 22px; font-weight: bold; }
        .section { margin-top: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 12px; }
        th { background: #f5f5f5; }
        .left { text-align: left; }
        .right { text-align: right; }
        .summary { width: 280px; margin-left: auto; margin-top: 15px; }
        .bold { font-weight: bold; }
        .footer { margin-top: 18px; text-align: center; font-size: 11px; }
      </style>
    </head>

    <body>
      <div class="header">
        <div>
          <div class="title">${order.store?.name || 'GO-KOOL CHASMAGHAR'}</div>
          <div>${order.store?.address || '235, Parbirata G.T. Road, Sripally'}</div>
          ${order.store?.gstNumber ? `<div>GSTIN: ${order.store.gstNumber}</div>` : ''}
          <div>Phone: ${order.store?.phone || '+91 9832906048'}</div>
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
          <div><b>Date:</b> ${require('date-fns').format(new Date(order.createdAt), 'dd-MMM-yyyy')}</div>
          <div><b>Delivery Date:</b> ${order.deliveryDate ? require('date-fns').format(new Date(order.deliveryDate), 'dd-MMM-yyyy'): 'Pending'}</div>
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
          ${itemRows}
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
            ${Number(order.redeemPoints || 0) > 0 ? `<tr>
              <td class="left">Loyalty Redeemed</td>
              <td class="right">-${fmt(order.redeemPoints)}</td>
            </tr>` : ''}

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
