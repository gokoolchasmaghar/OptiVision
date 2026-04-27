const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { launchPdfBrowser } = require('../utils/pdfBrowser');

router.use(authenticate);

const parseDateRange = (from, to) => {
  const dateFrom = from
    ? new Date(from)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const dateTo = to ? new Date(`${to}T23:59:59`) : new Date();
  return { dateFrom, dateTo };
};

const parseDailyDateRange = dateText => {
  const start = dateText ? new Date(`${dateText}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime())) {
    const err = new Error('Invalid date format. Use YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const parseMonthlyDateRange = monthText => {
  let start;
  if (monthText) {
    if (!/^\d{4}-\d{2}$/.test(monthText)) {
      const err = new Error('Invalid month format. Use YYYY-MM');
      err.status = 400;
      throw err;
    }
    start = new Date(`${monthText}-01T00:00:00`);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (Number.isNaN(start.getTime())) {
    const err = new Error('Invalid month format. Use YYYY-MM');
    err.status = 400;
    throw err;
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
};

const parseYearlyDateRange = yearText => {
  const year = yearText ? Number(yearText) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    const err = new Error('Invalid year format. Use YYYY');
    err.status = 400;
    throw err;
  }
  const start = new Date(year, 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1);
  return { start, end };
};

const esc = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = value =>
  `Rs ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = value => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatReportDate = value => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatRange = (start, endExclusive) => {
  const end = new Date(endExclusive);
  end.setMilliseconds(end.getMilliseconds() - 1);
  const from = formatReportDate(start);
  const to = formatReportDate(end);
  return from === to ? from : `${from} - ${to}`;
};

router.get('/sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { dateFrom, dateTo } = parseDateRange(from, to);
    const [sales, summary] = await Promise.all([
      prisma.$queryRaw`SELECT DATE("createdAt") as date, COUNT(*)::int as orders, COALESCE(SUM("totalAmount"),0)::float as revenue, COALESCE(SUM("discountAmount"),0)::float as discounts, COALESCE(SUM("taxAmount"),0)::float as tax FROM orders WHERE "storeId"=${req.storeId} AND status!='CANCELLED' AND "createdAt" BETWEEN ${dateFrom} AND ${dateTo} GROUP BY DATE("createdAt") ORDER BY date ASC`,
      prisma.order.aggregate({
        where: {
          storeId: req.storeId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: dateFrom, lte: dateTo }
        },
        _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
        _count: true,
        _avg: { totalAmount: true }
      })
    ]);
    res.json({ success: true, data: { sales, summary } });
  } catch (e) { next(e); }
});

router.get('/frames', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { dateFrom, dateTo } = parseDateRange(from, to);
    const data = await prisma.$queryRaw`SELECT f.brand, f.model, f."frameCode" as "frameCode", f."sellingPrice" as price, SUM(oi.quantity)::int as "unitsSold", SUM(oi."totalPrice")::float as revenue, SUM(oi."totalPrice" - oi.quantity*f."purchasePrice")::float as profit FROM order_items oi JOIN frames f ON oi."frameId"=f.id JOIN orders o ON oi."orderId"=o.id WHERE o."storeId"=${req.storeId} AND o.status!='CANCELLED' AND o."createdAt" BETWEEN ${dateFrom} AND ${dateTo} GROUP BY f.id,f.brand,f.model,f."frameCode",f."sellingPrice",f."purchasePrice" ORDER BY "unitsSold" DESC`;
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get('/customers', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { dateFrom, dateTo } = parseDateRange(from, to);
    const data = await prisma.$queryRaw`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        COUNT(o.id)::int as "totalOrders",
        COALESCE(SUM(o."totalAmount"),0)::float as "totalSpent",
        MAX(o."createdAt") as "lastOrder"
      FROM customers c
      LEFT JOIN orders o ON c.id=o."customerId"
        AND o.status!='CANCELLED'
        AND o."createdAt" BETWEEN ${dateFrom} AND ${dateTo}
      WHERE c."storeId"=${req.storeId}
      GROUP BY c.id,c.name,c.phone,c.email
      ORDER BY "totalSpent" DESC NULLS LAST
      LIMIT 20
    `;
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get('/profit', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { dateFrom, dateTo } = parseDateRange(from, to);
    const data = await prisma.$queryRaw`SELECT COALESCE(SUM(o."totalAmount"),0)::float as "totalRevenue", COALESCE(SUM(o."taxAmount"),0)::float as "totalTax", COALESCE(SUM(o."discountAmount"),0)::float as "totalDiscounts", COALESCE(SUM(CASE WHEN oi."frameId" IS NOT NULL THEN oi.quantity*(oi."unitPrice"-f."purchasePrice") WHEN oi."lensId" IS NOT NULL THEN oi.quantity*(oi."unitPrice"-l."purchasePrice") ELSE oi."totalPrice" END),0)::float as "grossProfit" FROM orders o JOIN order_items oi ON o.id=oi."orderId" LEFT JOIN frames f ON oi."frameId"=f.id LEFT JOIN lenses l ON oi."lensId"=l.id WHERE o."storeId"=${req.storeId} AND o.status!='CANCELLED' AND o."createdAt" BETWEEN ${dateFrom} AND ${dateTo}`;
    res.json({ success: true, data: data[0] });
  } catch (e) { next(e); }
});

const buildPdfHtml = ({ title, periodLabel, store, summary, orderRowsHtml, paymentRowsHtml, statusRowsHtml, topItemRowsHtml }) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 24px;
          color: #111827;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .title {
          margin: 0 0 6px;
          font-size: 24px;
        }
        .muted {
          color: #6b7280;
          font-size: 12px;
          margin: 2px 0;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 10px;
          background: #f9fafb;
        }
        .label {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .value {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 700;
        }
        h2 {
          margin: 18px 0 8px;
          font-size: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 7px 8px;
          text-align: left;
        }
        thead th {
          background: #f3f4f6;
          font-weight: 700;
        }
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">${title}</h1>
          <div class="muted"><strong>${esc(store?.name || 'GO-KOOL CHASMAGHAR')}</strong></div>
          <div class="muted">${esc(store?.address || '-')}</div>
          <div class="muted">${esc(store?.phone || '')} ${store?.email ? `| ${esc(store.email)}` : ''}</div>
        </div>
        <div style="text-align:right;">
          <div class="muted"><strong>Period</strong></div>
          <div>${periodLabel}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card"><div class="label">Orders</div><div class="value">${summary.orders}</div></div>
        <div class="card"><div class="label">Units Sold</div><div class="value">${summary.units}</div></div>
        <div class="card"><div class="label">Revenue</div><div class="value">${money(summary.revenue)}</div></div>
        <div class="card"><div class="label">Avg Order</div><div class="value">${money(summary.avgOrder)}</div></div>
        <div class="card"><div class="label">Discounts</div><div class="value">${money(summary.discount)}</div></div>
        <div class="card"><div class="label">Tax</div><div class="value">${money(summary.tax)}</div></div>
        <div class="card"><div class="label">Advance</div><div class="value">${money(summary.advance)}</div></div>
        <div class="card"><div class="label">Due</div><div class="value">${money(summary.due)}</div></div>
      </div>

      <h2>Orders</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Order No.</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Created At</th>
            <th>Payment</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${orderRowsHtml}</tbody>
      </table>

      <div class="two-col">
        <div>
          <h2>Payment Breakdown</h2>
          <table>
            <thead>
              <tr><th>Method</th><th style="text-align:right;">Orders</th><th style="text-align:right;">Revenue</th></tr>
            </thead>
            <tbody>${paymentRowsHtml}</tbody>
          </table>
        </div>
        <div>
          <h2>Status Breakdown</h2>
          <table>
            <thead>
              <tr><th>Status</th><th style="text-align:right;">Count</th></tr>
            </thead>
            <tbody>${statusRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <h2>Top Sold Items</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th style="text-align:right;">Units</th>
            <th style="text-align:right;">Revenue</th>
          </tr>
        </thead>
        <tbody>${topItemRowsHtml}</tbody>
      </table>
    </body>
  </html>
`;

const generatePeriodPdf = async ({ req, res, start, end, title, fileSlug }) => {
  const [store, orders, totals, paymentBreakdown, statusBreakdown, topItems] = await Promise.all([
    prisma.store.findUnique({
      where: { id: req.storeId },
      select: { name: true, address: true, phone: true, email: true }
    }),
    prisma.order.findMany({
      where: {
        storeId: req.storeId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lt: end }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        customer: { select: { name: true, phone: true } },
        items: { select: { quantity: true } }
      }
    }),
    prisma.order.aggregate({
      where: {
        storeId: req.storeId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lt: end }
      },
      _sum: {
        totalAmount: true,
        discountAmount: true,
        taxAmount: true,
        advanceAmount: true,
        balanceAmount: true
      },
      _count: true,
      _avg: { totalAmount: true }
    }),
    prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        storeId: req.storeId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lt: end }
      },
      _count: true,
      _sum: { totalAmount: true }
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: {
        storeId: req.storeId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lt: end }
      },
      _count: true
    }),
    prisma.$queryRaw`
      SELECT
        oi.name as "name",
        oi."itemType" as "itemType",
        SUM(oi.quantity)::int as "units",
        SUM(oi."totalPrice")::float as "revenue"
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      WHERE o."storeId" = ${req.storeId}
        AND o.status != 'CANCELLED'
        AND o."createdAt" >= ${start}
        AND o."createdAt" < ${end}
      GROUP BY oi.name, oi."itemType"
      ORDER BY "units" DESC, "revenue" DESC
      LIMIT 10
    `
  ]);

  const summary = {
    orders: totals._count || 0,
    revenue: totals._sum.totalAmount || 0,
    discount: totals._sum.discountAmount || 0,
    tax: totals._sum.taxAmount || 0,
    advance: totals._sum.advanceAmount || 0,
    due: totals._sum.balanceAmount || 0,
    avgOrder: totals._avg.totalAmount || 0,
    units: orders.reduce(
      (sum, order) => sum + order.items.reduce((inner, i) => inner + Number(i.quantity || 0), 0),
      0
    ),
  };

  const orderRowsHtml = orders.length
    ? orders.map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(order.orderNumber)}</td>
        <td>${esc(order.customer?.name || '-')}</td>
        <td>${esc(order.customer?.phone || '-')}</td>
        <td>${formatDateTime(order.createdAt)}</td>
        <td>${esc(order.paymentStatus)}</td>
        <td style="text-align:right;">${money(order.totalAmount)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="7" style="text-align:center; color:#6b7280;">No orders for this period</td></tr>`;

  const paymentRowsHtml = paymentBreakdown.length
    ? paymentBreakdown.map(p => `
      <tr>
        <td>${esc(p.paymentMethod)}</td>
        <td style="text-align:right;">${p._count}</td>
        <td style="text-align:right;">${money(p._sum.totalAmount)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No payment data</td></tr>';

  const statusRowsHtml = statusBreakdown.length
    ? statusBreakdown.map(s => `
      <tr>
        <td>${esc(s.status)}</td>
        <td style="text-align:right;">${s._count}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="2" style="text-align:center; color:#6b7280;">No status data</td></tr>';

  const topItemRowsHtml = topItems.length
    ? topItems.map(i => `
      <tr>
        <td>${esc(i.name)}</td>
        <td>${esc(i.itemType)}</td>
        <td style="text-align:right;">${i.units}</td>
        <td style="text-align:right;">${money(i.revenue)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" style="text-align:center; color:#6b7280;">No item sales</td></tr>';

  const html = buildPdfHtml({
    title,
    periodLabel: formatRange(start, end),
    store,
    summary,
    orderRowsHtml,
    paymentRowsHtml,
    statusRowsHtml,
    topItemRowsHtml,
  });

  const browser = await launchPdfBrowser();
  let pdf;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    pdf = await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=${fileSlug}.pdf`,
    'Content-Length': pdf.length,
  });
  return res.end(pdf);
};

router.get('/daily/pdf', async (req, res, next) => {
  try {
    const { date } = req.query;
    const { start, end } = parseDailyDateRange(date);
    const fileSlug = `daily-report-${start.toISOString().slice(0, 10)}`;
    return await generatePeriodPdf({ req, res, start, end, title: 'Daily Report', fileSlug });
  } catch (e) { next(e); }
});

router.get('/monthly/pdf', async (req, res, next) => {
  try {
    const { month } = req.query;
    const now = new Date();
    const selected = new Date(month + "-01");
    if (selected > now) {
      return res.status(400).json({
        message: "Future month report not allowed"
      });
    }
    const { start, end } = parseMonthlyDateRange(month);
    const fileSlug = `monthly-report-${start.toISOString().slice(0, 7)}`;
    return await generatePeriodPdf({ req, res, start, end, title: 'Monthly Report', fileSlug });
  } catch (e) { next(e); }
});

router.get('/yearly/pdf', async (req, res, next) => {
  try {
    const { year } = req.query;
    const currentYear = new Date().getFullYear();

    if (Number(year) > currentYear) {
      return res.status(400).json({
        message: "Future year report not allowed"
      });
    }
    const { start, end } = parseYearlyDateRange(year);
    const fileSlug = `yearly-report-${start.getFullYear()}`;
    return await generatePeriodPdf({ req, res, start, end, title: 'Yearly Report', fileSlug });
  } catch (e) { next(e); }
});

module.exports = router;
