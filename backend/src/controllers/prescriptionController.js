const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prisma = require('../utils/prisma');

exports.downloadPrescription = async (req, res) => {
  try {
    const { id } = req.params;

    const rx = await prisma.prescription.findFirst({
      where: {
        id,
        customer: { storeId: req.storeId }
      },
      include: { customer: true }
    });

    if (!rx) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    const html = `
<div style="font-family:Arial, sans-serif; padding:30px; color:#1e293b;">

  <!-- Header -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    
    <div>
      <h2 style="margin:0; color:#2563eb;">OptiVision</h2>
      <div style="font-size:12px; color:#64748b; margin-top:4px;">
        Your Store Address Line 1<br/>
        City, State - 000000<br/>
        Phone: +91 9876543210
      </div>
    </div>

    <div style="text-align:right;">
      <div style="font-size:12px; color:#64748b;">Prescription</div>
      <div style="font-weight:bold;">#${rx.id}</div>
      <div style="font-size:12px; margin-top:4px;">
        ${new Date(rx.date).toDateString()}
      </div>
    </div>

  </div>

  <hr style="margin:20px 0; border:none; border-top:1px solid #e2e8f0;" />

  <!-- Customer -->
  <div style="margin-bottom:20px;">
    <div style="font-weight:bold;">Customer</div>
    <div style="margin-top:4px;">
      ${rx.customer.name}<br/>
      ${rx.customer.phone || ''}
    </div>
  </div>

  <!-- Table -->
  <div>
    <div style="font-weight:bold; margin-bottom:8px;">Eye Power</div>

    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px; border:1px solid #e2e8f0;"></th>
          <th style="padding:10px; border:1px solid #e2e8f0;">Right Eye (OD)</th>
          <th style="padding:10px; border:1px solid #e2e8f0;">Left Eye (OS)</th>
        </tr>
      </thead>
      <tbody>
        ${row('SPH', rx.rightSph, rx.leftSph)}
        ${row('CYL', rx.rightCyl, rx.leftCyl)}
        ${row('AXIS', rx.rightAxis, rx.leftAxis)}
        ${row('ADD', rx.rightAdd, rx.leftAdd)}
        ${row('PD', rx.rightPd || rx.pd, rx.leftPd || rx.pd)}
      </tbody>
    </table>
  </div>

  <!-- Doctor -->
  ${rx.doctorName
        ? `<div style="margin-top:20px;">
          <strong>Doctor:</strong> Dr. ${rx.doctorName}
        </div>`
        : ''
      }

  <!-- Footer -->
  <div style="margin-top:40px; text-align:center; font-size:12px; color:#64748b;">
    Thank you for trusting OptiVision 👓<br/>
    We care for your vision.
  </div>

</div>
`;

    const isProd = process.env.NODE_ENV === 'production';

    const browser = await puppeteer.launch(
      isProd
        ? {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless
        }
        : {
          headless: 'new' // ✅ local Chrome
        }
    );

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Prescription-${rx.customer.name}.pdf`
    });

    res.send(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'PDF generation failed' });
  }
};

function row(label, r, l) {
  return `
    <tr>
      <td style="padding:8px;border:1px solid #ccc;">${label}</td>
      <td style="padding:8px;border:1px solid #ccc;text-align:center;">${r ?? '-'}</td>
      <td style="padding:8px;border:1px solid #ccc;text-align:center;">${l ?? '-'}</td>
    </tr>
  `;
}