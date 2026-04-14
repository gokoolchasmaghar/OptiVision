import puppeteer from 'puppeteer';
import prisma from '../utils/prisma.js';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, storeId: req.storeId },
      include: {
        customer: true,
        items: true,
        payments: true,
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const html = `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 24px; color:#333 }
        h2 { margin-bottom: 4px; }
        table { width:100%; border-collapse: collapse; margin-top:10px }
        th, td { padding:8px; border-bottom:1px solid #ddd }
        th { background:#f5f5f5 }
        .right { text-align:right }
      </style>
    </head>

    <body>

      <h2>Invoice</h2>
      <p><b>Invoice #:</b> ${order.orderNumber}</p>
      <p><b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}</p>

      <h3>Customer</h3>
      <p>${order.customer?.name || ''}</p>
      <p>${order.customer?.phone || ''}</p>
      <p>${order.customer?.address || ''}</p>

      <h3>Items</h3>
      <table>
        <tr>
          <th>Item</th><th>Type</th><th>Qty</th><th>Price</th><th>Total</th>
        </tr>

        ${order.items.map(i => `
          <tr>
            <td>${i.name}</td>
            <td>${i.itemType}</td>
            <td class="right">${i.quantity}</td>
            <td class="right">${fmt(i.unitPrice)}</td>
            <td class="right">${fmt(i.totalPrice)}</td>
          </tr>
        `).join('')}
      </table>

      <h3>Summary</h3>
      <p>Subtotal: ${fmt(order.subtotal)}</p>
      ${order.discountAmount > 0 ? `<p>Discount: -${fmt(order.discountAmount)}</p>` : ''}
      ${order.redeemPoints > 0 ? `<p>Loyalty Used: -${fmt(order.redeemPoints)}</p>` : ''}
      <p>GST: ${fmt(order.taxAmount)}</p>
      <p><b>Total: ${fmt(order.totalAmount)}</b></p>
      <p>Advance: ${fmt(order.advanceAmount)}</p>
      <p><b>Balance: ${fmt(order.balanceAmount)}</b></p>

      <p style="margin-top:20px;font-size:12px;color:#777">
        Thank you for your business!
      </p>

    </body>
    </html>
    `;

    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=invoice-${order.orderNumber}.pdf`,
    });

    return res.status(200).end(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Invoice generation failed' });
  }
};

export { generateInvoice };
