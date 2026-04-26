import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import prisma from '../utils/prisma.js';
import bwipjs from 'bwip-js';
import { applyDiscount } from '../utils/calculatePay.js';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, storeId: req.storeId },
      include: {
        customer: true,
        items: true,
        payments: true,
        prescription: {
          create: {
            rightSph: data.rightSph,
            rightCyl: data.rightCyl,
            rightAxis: data.rightAxis,
            rightAdd: data.rightAdd,

            leftSph: data.leftSph,
            leftCyl: data.leftCyl,
            leftAxis: data.leftAxis,
            leftAdd: data.leftAdd,

            pd: data.pd,
          }
        },
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const itemsWithDiscount = applyDiscount(order);
    const subtotalAfterDiscount = itemsWithDiscount.reduce(
      (sum, i) => sum + Number(i.finalPrice || 0),
      0
    );

    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: order.orderNumber,
      scale: 3,
      height: 12,
      includetext: false,
    });

    const barcodeBase64 = barcodeBuffer.toString('base64');
    const barcodeImg = `data:image/png;base64,${barcodeBase64}`;

    const formatPower = (val) => {
      if (val === null || val === undefined) return "0.00";
      return Number(val).toFixed(2);
    };

    const formatPD = (val) => {
      if (val === null || val === undefined || isNaN(val)) return "-";
      return Number(val).toFixed(0);
    };

    // ----------------------
    // HTML TEMPLATE
    // ----------------------
    const html = `
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
          <img src="${barcodeImg}" style="height:70px;" />
          <div style="margin-top:6px; font-weight:bold;">
            ${order.orderNumber}
          </div>
        </div>
      </div>

      <!-- INVOICE INFO -->
      <div class="section" style="display:flex; justify-content:space-between;">
        <div><b>Invoice No:</b> ${order.orderNumber}</div>
        <div><b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}</div>
      </div>

      <!-- CUSTOMER -->
      <div class="section">
        <b>Customer Name:</b> ${order.customer?.name || '-'}<br/>
        <b>Mobile:</b> ${order.customer?.phone || '-'}
      </div>

      <!-- EYE POWER -->
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
            <td>${rx.rightAxis ?? '-'}</td>
            <td>${rx.leftAxis ?? '-'}</td>
          </tr>

          <tr>
            <td>ADD</td>
            <td>${formatPower(rx.rightAdd)}</td>
            <td>${formatPower(rx.leftAdd)}</td>
          </tr>

          <tr>
            <td>ADD</td>
            <td>${formatPower(rx.rightAdd)}</td>
            <td>${formatPower(rx.leftAdd)}</td>
          </tr>
        </table>

        <!-- PD -->
        <div style="margin-top:10px;">
          <b>PD (mm):</b> ${formatPD(rx.pd)}
        </div>
      </div>
      ` : ''}

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

          ${itemsWithDiscount.map(i => `
            <tr>
              <td class="left">${i.name}</td>
              <td>${i.quantity}</td>
              <td>${fmt(i.unitPrice)}</td>
              <td>${i.appliedDiscountPct.toFixed(2)}%</td>
              <td>${fmt(i.finalPrice)}</td>
            </tr>
          `).join('')}
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

    // ----------------------
    // PUPPETEER
    // ----------------------
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    // ----------------------
    // RESPONSE (CRITICAL FIX)
    // ----------------------
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${order.orderNumber}.pdf`
    );
    res.setHeader('Content-Length', pdf.length);

    // ✅ THIS LINE FIXES CORRUPTION
    return res.end(pdf, 'binary');

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Invoice generation failed' });
  }
};

export const generatePublicInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id }, // IMPORTANT
      include: {
        customer: true,
        items: true,
        payments: true,
        prescription: {
          create: {
            rightSph: data.rightSph,
            rightCyl: data.rightCyl,
            rightAxis: data.rightAxis,
            rightAdd: data.rightAdd,

            leftSph: data.leftSph,
            leftCyl: data.leftCyl,
            leftAxis: data.leftAxis,
            leftAdd: data.leftAdd,

            pd: data.pd,
          }
        }
      }
    });

    console.log("FULL ORDER:", order);
    console.log("PRESCRIPTION:", order.prescription);

    if (!order) {
      return res.status(404).send('Invoice not found');
    }

    const subtotal = order.items.reduce(
      (sum, i) => sum + Number(i.totalPrice || 0),
      0
    );

    let remainingDiscount = Number(order.discountAmount || 0);

    const itemsWithDiscount = order.items.map((item, index) => {
      const itemTotal = Number(item.totalPrice || 0);
      const ratio = subtotal > 0 ? itemTotal / subtotal : 0;

      let discountAmount = Number((ratio * remainingDiscount).toFixed(2));
      if (index === order.items.length - 1) {
        discountAmount = Number(remainingDiscount.toFixed(2));
      }

      remainingDiscount -= discountAmount;
      const appliedDiscountPct =
        itemTotal > 0 ? (discountAmount / itemTotal) * 100 : 0;

      return {
        ...item,
        discountAmount,
        appliedDiscountPct,
        finalPrice: itemTotal - discountAmount,
      };
    });

    const subtotalAfterDiscount = itemsWithDiscount.reduce(
      (sum, i) => sum + Number(i.finalPrice || 0),
      0
    );

    // ----------------------
    // HTML TEMPLATE
    // ----------------------
    const html = `
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
          <div style="margin-top:6px; font-weight:bold;">
            ${order.orderNumber}
          </div>
        </div>
      </div>

      <!-- INVOICE INFO -->
      <div class="section" style="display:flex; justify-content:space-between;">
        <div><b>Invoice No:</b> ${order.orderNumber}</div>
        <div><b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}</div>
      </div>

      <!-- CUSTOMER -->
      <div class="section">
        <b>Customer Name:</b> ${order.customer?.name || '-'}<br/>
        <b>Mobile:</b> ${order.customer?.phone || '-'}
      </div>

      <!-- EYE POWER -->
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
            <td>${rx.rightAxis ?? '-'}</td>
            <td>${rx.leftAxis ?? '-'}</td>
          </tr>

          <tr>
            <td>ADD</td>
            <td>${formatPower(rx.rightAdd)}</td>
            <td>${formatPower(rx.leftAdd)}</td>
          </tr>
        </table>

        <!-- PD -->
        <div style="margin-top:10px;">
          <b>PD (mm):</b> ${formatPD(rx.pd)}
        </div>
      </div>
      ` : ''}

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

          ${itemsWithDiscount.map(i => `
            <tr>
              <td class="left">${i.name}</td>
              <td>${i.quantity}</td>
              <td>${fmt(i.unitPrice)}</td>
              <td>${i.appliedDiscountPct.toFixed(2)}%</td>
              <td>${fmt(i.finalPrice)}</td>
            </tr>
          `).join('')}
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

    // ----------------------
    // PUPPETEER
    // ----------------------
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: 'A4' });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=invoice-${order.orderNumber}.pdf`,
    });

    return res.end(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).send('Invoice generation failed');
  }
};