const prisma = require('../utils/prisma');
const { launchPdfBrowser } = require('../utils/pdfBrowser');

const BRAND_NAME = 'GO-KOOL CHASMAGHAR';
const BRAND_ADDRESS = '235, Parbirata G.T. Road, Sripally near SBI, Burdwan, Purba Bardhaman, West Bengal - 713103';

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
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(2);
};

const formatAxis = value => {
  if (value === null || value === undefined || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return String(Math.trunc(n));
};

const formatPd = value => {
  if (value === null || value === undefined || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(0);
};

const formatEyeTestDate = date => {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  const day = new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
  return `${weekday}, ${day} ${month} ${year}`;
};

const buildOldStyleTable = rx => `
  <table class="rx-table">
    <thead>
      <tr>
        <th></th>
        <th>Right Eye (OD)</th>
        <th>Left Eye (OS)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>SPH</td>
        <td>${escapeHtml(formatSigned(rx.rightSph))}</td>
        <td>${escapeHtml(formatSigned(rx.leftSph))}</td>
      </tr>
      <tr>
        <td>CYL</td>
        <td>${escapeHtml(formatSigned(rx.rightCyl))}</td>
        <td>${escapeHtml(formatSigned(rx.leftCyl))}</td>
      </tr>
      <tr>
        <td>AXIS</td>
        <td>${escapeHtml(formatAxis(rx.rightAxis))}</td>
        <td>${escapeHtml(formatAxis(rx.leftAxis))}</td>
      </tr>
      <tr>
        <td>ADD</td>
        <td>${escapeHtml(formatSigned(rx.rightAdd))}</td>
        <td>${escapeHtml(formatSigned(rx.leftAdd))}</td>
      </tr>
      <tr>
        <td>PD</td>
        <td>${escapeHtml(formatPd(rx.rightPd ?? rx.pd))}</td>
        <td>${escapeHtml(formatPd(rx.leftPd ?? rx.pd))}</td>
      </tr>
    </tbody>
  </table>
`;

const buildPrescriptionHtml = rx => {
  const testDate = rx.date ? new Date(rx.date) : new Date();
  const customerName = escapeHtml(rx.customer?.name || 'Customer');
  const customerPhone = escapeHtml(rx.customer?.phone || '--');
  const customerAge = rx.customer?.age !== null && rx.customer?.age !== undefined
    ? `${escapeHtml(rx.customer.age)} yrs`
    : '--';
  const eyeTestDate = escapeHtml(formatEyeTestDate(testDate));

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 28px 22px;
          background: #f3f4f6;
          font-family: Arial, sans-serif;
          color: #111827;
        }
        .sheet {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 14px;
        }
        .brand-mark {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: #111827;
          margin-bottom: 8px;
        }
        .title {
          margin: 0;
          font-size: 38px;
          font-weight: 700;
          color: #111827;
          line-height: 1.05;
        }
        .divider {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 18px 0 20px;
        }
        .top-row {
          display: flex;
          gap: 18px;
          align-items: stretch;
          margin-bottom: 18px;
        }
        .customer-col {
          flex: 1;
          min-width: 210px;
          padding-top: 4px;
        }
        .label {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 6px;
        }
        .value-strong {
          font-size: 34px;
          font-weight: 700;
          color: #111827;
          line-height: 1.15;
          margin-bottom: 8px;
        }
        .customer-meta {
          color: #4b5563;
          font-size: 13px;
          line-height: 1.5;
        }
        .meta-card {
          flex: 1.3;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px 16px;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin: 2px 0;
          font-size: 14px;
        }
        .meta-row .k {
          color: #6b7280;
        }
        .meta-row .v {
          color: #111827;
          font-weight: 600;
          text-align: right;
        }
        .section-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .section-title {
          margin: 0 0 12px;
          font-size: 30px;
          font-weight: 700;
          color: #111827;
        }
        .rx-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .rx-table th,
        .rx-table td {
          border: 1px solid #d1d5db;
          padding: 10px 8px;
          text-align: center;
          color: #111827;
        }
        .rx-table thead th {
          background: #f3f4f6;
          font-weight: 700;
        }
        .rx-table tbody td:first-child {
          background: #f9fafb;
          font-weight: 700;
          text-align: left;
          padding-left: 12px;
        }
        .doctor-pill {
          display: inline-block;
          margin-top: 10px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid #fdba74;
          background: #fff7ed;
          color: #9a3412;
          font-size: 13px;
          font-weight: 700;
        }
        .foot {
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div class="brand-mark">${escapeHtml(BRAND_NAME)}</div>
          <h1 class="title">Eye Test Prescription</h1>
        </div>

        <hr class="divider" />

        <div class="top-row">
          <div class="customer-col">
            <div class="label">Customer Name</div>
            <div class="value-strong">${customerName}</div>
            <div class="customer-meta">Age: ${customerAge}</div>
            <div class="customer-meta">Phone: ${customerPhone}</div>
          </div>

          <div class="meta-card">
            <div class="meta-row">
              <span class="k">Eye Test Date</span>
              <span class="v">${eyeTestDate}</span>
            </div>
            <div class="meta-row">
              <span class="k">Store Address</span>
              <span class="v">${escapeHtml(BRAND_ADDRESS)}</span>
            </div>
          </div>
        </div>

        <section class="section-card">
          <h2 class="section-title">Eye Power</h2>
          ${buildOldStyleTable(rx)}
          ${rx.lensType ? `
            <div style="margin-top:10px; font-size:14px;">
              <b>Lens Type:</b> ${escapeHtml(rx.lensType.replace('_', ' '))}
            </div>
          ` : ''}
          ${rx.doctorName ? `<div class="doctor-pill">Doctor: ${escapeHtml(rx.doctorName)}</div>` : ''}
        </section>

        <div class="foot">Note: This is a system-generated prescription.</div>
      </div>
    </body>
  </html>
  `;
};

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
      pdf = await page.pdf({ format: 'A4', printBackground: true });
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
