const prisma = require('../utils/prisma');
const { launchPdfBrowser } = require('../utils/pdfBrowser');

const BRAND_NAME = 'GO-KOOL CHASMAGHAR';
const BRAND_ADDRESS = '235, Parbirata G.T. Road, Sripally near SBI, Burdwan, Purba Bardhaman, West Bengal - 713103';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatSigned = value => {
  if (value === null || value === undefined || value === '') return '--';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '--';
};

const formatAxis = value => {
  if (value === null || value === undefined || value === '') return '--';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : '--';
};

const formatPd = value => {
  if (value === null || value === undefined || value === '') return '--';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(0) : '--';
};

const formatEyeTestDate = date => {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  const day = new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
  return `${weekday}, ${day} ${month} ${year}`;
};

// ─────────────────────────────────────────
// HTML Builder
// ─────────────────────────────────────────
const buildPrescriptionHtml = rx => {
  const testDate = rx.date ? new Date(rx.date) : new Date();

  const storeName = escapeHtml(rx.customer?.store?.name || BRAND_NAME);
  const storeAddress = escapeHtml(rx.customer?.store?.address || BRAND_ADDRESS);

  const customerName = escapeHtml(rx.customer?.name || 'Customer');
  const customerPhone = escapeHtml(rx.customer?.phone || '--');

  const customerAge =
    rx.customer?.age !== null && rx.customer?.age !== undefined
      ? `${escapeHtml(rx.customer.age)} yrs`
      : '--';

  const eyeTestDate = escapeHtml(formatEyeTestDate(testDate));

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { 
          box-sizing: border-box; 
          page-break-inside: avoid;
        }

        body {
           margin: 0;
            padding: 16px 20px;
            background: #ffffff;
            font-family: Arial, sans-serif;
            color: #111827;

            height: 148mm;          /* 🔥 match PDF height */
            overflow: hidden;
        }

        .sheet {
          max-width: 700px;
          margin: auto;
        }

        .header {
          text-align: center;
          margin-bottom: 16px;
        }

        .header,
        .top {
          flex-shrink: 0;
        }

        .top > div:first-child {
          width: 220px;   /* left block fixed */
        }

        .title {
          font-size: 24px;
          font-weight: 600;
          margin-top: 6px;
        }

        .divider {
          border-top: 1px solid #e5e7eb;
          margin: 18px 0;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 60px;
          margin-bottom: 24px;  
        }

        .label {
          font-size: 12px;
          color: #6b7280;
        }

        .meta {
          margin-top: 6px;
          font-size: 12px;
          color: #6b7280;
        }

        .card {
          flex: 1;
          background: #f3f4f6;
          border-radius: 12px;
          padding: 14px;
        }

        .card-row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 10px;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .section {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 10px; 
        }
        
        .section table {
          flex: 1;
        }

        .section-title {
          font-size: 17px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .name {
          font-size: 20px;
          font-weight: 600;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        th, td {
          padding: 12px;   /* increased from 8 → FIXED */
          text-align: center;
          font-size: 13px;
        }

        thead {
          background: #f9fafb;
          font-weight: 600;
        }

        tbody td {
          border: 1px solid #eef2f7;
          color: #6b7280;   /* consistent grey for all values */
        }

        tbody td:first-child {
          text-align: left;
          font-weight: 500;
          background: #f9fafb;
          color: #6b7280;   /* same grey */
        }

        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
          color: #6b7280;
        }

      </style>
    </head>

    <body>
      <div class="sheet">

        <div class="header">
          <h2>${storeName}</h2>
          <div class="title">Eye Test Prescription</div>
        </div>

        <div class="divider"></div>

        <div class="top">
          <div>
            <div class="label">Customer Name</div>
            <div class="name">${customerName}</div>
            <div class="meta">
              Age: ${customerAge}<br/>
              Phone: ${customerPhone}
            </div>
          </div>

          <div class="card">
            <div class="card-row">
              <span>Eye Test Date</span>
              <span>${eyeTestDate}</span>
            </div>
            <div class="card-row">
              <span>Store Address</span>
              <span>${storeAddress}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Single Vision Power</div>

          <table>
            <thead>
              <tr>
                <th>Rx</th>
                <th>Spherical</th>
                <th>Cylindrical</th>
                <th>Axis</th>
                <th>Add. Power</th>
                <th>Pupil Distance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Right Eye</td>
                <td>${escapeHtml(formatSigned(rx.rightSph))}</td>
                <td>${escapeHtml(formatSigned(rx.rightCyl))}</td>
                <td>${escapeHtml(formatAxis(rx.rightAxis))}</td>
                <td>${escapeHtml(formatSigned(rx.rightAdd))}</td>
                <td>${escapeHtml(formatPd(rx.rightPd ?? rx.pd))}</td>
              </tr>
              <tr>
                <td>Left Eye</td>
                <td>${escapeHtml(formatSigned(rx.leftSph))}</td>
                <td>${escapeHtml(formatSigned(rx.leftCyl))}</td>
                <td>${escapeHtml(formatAxis(rx.leftAxis))}</td>
                <td>${escapeHtml(formatSigned(rx.leftAdd))}</td>
                <td>${escapeHtml(formatPd(rx.leftPd ?? rx.pd))}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:10px; font-size:13px; color:#374151;">
            <strong>Lens Type:</strong> ${escapeHtml(rx.lensType || '—')}
          </div>

        </div>

        <div class="footer">
          Note: This is a system-generated prescription.
        </div>

      </div>
    </body>
  </html>
  `;
};

// ─────────────────────────────────────────
// Controller
// ─────────────────────────────────────────
exports.downloadPrescription = async (req, res) => {
  try {
    const { id } = req.params;

    const rx = await prisma.prescription.findFirst({
      where: {
        id,
        customer: { storeId: req.storeId }
      },
      include: {
        customer: {
          include: {
            store: {
              select: {
                name: true,
                address: true,
              }
            }
          }
        }
      }
    });

    if (!rx) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const browser = await launchPdfBrowser();

    let pdf;
    try {
      const page = await browser.newPage();
      await page.setContent(buildPrescriptionHtml(rx), {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      pdf = await page.pdf({
        width: '210mm',
        height: '148mm', // Half A4
        printBackground: true
      });

    } finally {
      await browser.close();
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Prescription-${id}.pdf`,
      'Content-Length': pdf.length,
    });

    return res.end(pdf);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'PDF generation failed' });
  }
};