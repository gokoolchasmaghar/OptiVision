// inventory.js
const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin, requireRole } = require('../middleware/auth');
const { launchPdfBrowser } = require('../utils/pdfBrowser');
router.use(authenticate);

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

const stockStatus = (qty, alert) => {
  if (Number(qty || 0) === 0) return 'Out of Stock';
  if (Number(qty || 0) <= Number(alert || 0)) return 'Low Stock';
  return 'OK';
};

const AUDIT_ITEM_TYPES = {
  FRAME: 'FRAME',
  FRAMES: 'FRAME',
  LENS: 'LENS',
  LENSES: 'LENS',
  ACCESSORY: 'ACCESSORY',
  ACCESSORIES: 'ACCESSORY',
};

const normalizeAuditItemType = value => AUDIT_ITEM_TYPES[String(value || '').trim().toUpperCase()] || null;

const assertInventoryAuditClient = () => {
  if (!prisma.inventoryAudit || !prisma.inventoryAuditItem) {
    const error = new Error('Inventory audit tables are not available. Run the latest Prisma migration and regenerate the Prisma client.');
    error.status = 503;
    throw error;
  }
};

const authenticatedUserId = req => {
  const userId = req.user?.id;
  if (!userId) {
    const error = new Error('Authenticated user not found');
    error.status = 401;
    throw error;
  }
  return userId;
};

const selectAuditInventoryItem = async (tx, storeId, itemType, itemId, itemBarcode) => {
  const id = String(itemId || '').trim();
  const barcode = String(itemBarcode || '').trim();
  const identity = id ? { id } : barcode ? { barcode } : null;
  if (!identity) return null;

  if (itemType === 'FRAME') {
    const item = await tx.frame.findFirst({
      where: { ...identity, storeId, isActive: true },
      select: { id: true, brand: true, model: true, frameCode: true, barcode: true, stockQty: true },
    });
    return item && {
      id: item.id,
      name: [item.brand, item.model].filter(Boolean).join(' ') || item.frameCode,
      barcode: item.barcode,
      stockQty: item.stockQty,
    };
  }

  if (itemType === 'LENS') {
    const item = await tx.lens.findFirst({
      where: { ...identity, storeId, isActive: true },
      select: { id: true, name: true, barcode: true, stockQty: true },
    });
    return item && { id: item.id, name: item.name, barcode: item.barcode, stockQty: item.stockQty };
  }

  if (itemType === 'ACCESSORY') {
    const item = await tx.accessory.findFirst({
      where: { ...identity, storeId, isActive: true },
      select: { id: true, name: true, barcode: true, stockQty: true },
    });
    return item && { id: item.id, name: item.name, barcode: item.barcode, stockQty: item.stockQty };
  }

  return null;
};

const updateAuditInventoryItem = async (tx, storeId, itemType, itemId, stockQty) => {
  const where = { id: itemId, storeId, isActive: true };
  if (itemType === 'FRAME') return tx.frame.updateMany({ where, data: { stockQty } });
  if (itemType === 'LENS') return tx.lens.updateMany({ where, data: { stockQty } });
  if (itemType === 'ACCESSORY') return tx.accessory.updateMany({ where, data: { stockQty } });
  return { count: 0 };
};

const reportDate = () =>
  new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const buildStockReportHtml = ({ store, rows, summary }) => {
  const rowsHtml = rows.length
    ? rows.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(item.type)}</td>
        <td>
          <strong>${esc(item.name)}</strong>
          <div class="muted">${esc(item.detail || '-')}</div>
        </td>
        <td>${esc(item.barcode)}</td>
        <td class="num">${money(item.purchasePrice)}</td>
        <td class="num">${money(item.sellingPrice)}</td>
        <td class="num">${item.stockQty}</td>
        <td class="num">${item.lowStockAlert}</td>
        <td>${esc(item.status)}</td>
        <td class="num">${money(item.totalValue)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="10" class="empty">No inventory found</td></tr>';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            color: #111827;
            background: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 14px;
            border-bottom: 2px solid #111827;
            margin-bottom: 16px;
          }
          h1 {
            margin: 0 0 6px;
            font-size: 26px;
            letter-spacing: 0;
          }
          .muted {
            color: #6b7280;
            font-size: 11px;
            margin-top: 2px;
          }
          .meta {
            text-align: right;
            font-size: 12px;
            color: #374151;
            line-height: 1.5;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin: 16px 0;
          }
          .card {
            border: 1px solid #d1d5db;
            background: #f9fafb;
            border-radius: 8px;
            padding: 10px;
          }
          .label {
            color: #6b7280;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .value {
            margin-top: 5px;
            font-size: 16px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 6px;
            vertical-align: top;
          }
          thead th {
            background: #111827;
            color: #ffffff;
            font-weight: 700;
          }
          tbody tr:nth-child(even) td {
            background: #f9fafb;
          }
          .num {
            text-align: right;
            white-space: nowrap;
          }
          .empty {
            text-align: center;
            color: #6b7280;
            padding: 16px;
          }
          .footer {
            margin-top: 12px;
            font-size: 10px;
            color: #6b7280;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Stock Report</h1>
            <div><strong>${esc(store?.name || 'OptiVision')}</strong></div>
            <div class="muted">${esc(store?.address || '-')}</div>
            <div class="muted">${esc(store?.phone || '')}${store?.email ? ` | ${esc(store.email)}` : ''}</div>
          </div>
          <div class="meta">
            <div><strong>Generated</strong></div>
            <div>${reportDate()}</div>
            <div>Prepared for: SUPER_ADMIN</div>
          </div>
        </div>

        <div class="summary">
          <div class="card"><div class="label">Products</div><div class="value">${summary.totalItems}</div></div>
          <div class="card"><div class="label">Units</div><div class="value">${summary.totalUnits}</div></div>
          <div class="card"><div class="label">Low Stock</div><div class="value">${summary.lowStock}</div></div>
          <div class="card"><div class="label">Out of Stock</div><div class="value">${summary.outOfStock}</div></div>
          <div class="card"><div class="label">Inventory Value</div><div class="value">${money(summary.totalValue)}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Product Name</th>
              <th>Barcode</th>
              <th>Purchase Price</th>
              <th>Selling Price</th>
              <th>Stock Qty</th>
              <th>Low Stock Alert</th>
              <th>Status</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="footer">Total value is calculated as selling price x stock quantity.</div>
      </body>
    </html>
  `;
};

router.get('/stock-report/pdf', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const [store, frames, lenses, accessories] = await Promise.all([
      prisma.store.findUnique({
        where: { id: req.storeId },
        select: { name: true, address: true, phone: true, email: true }
      }),
      prisma.frame.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: [{ brand: 'asc' }, { model: 'asc' }] }),
      prisma.lens.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { name: 'asc' } }),
      prisma.accessory.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { name: 'asc' } }),
    ]);

    const rows = [
      ...frames.map(f => ({
        type: 'Frame',
        name: [f.brand, f.model].filter(Boolean).join(' ') || f.frameCode,
        detail: [f.frameCode, f.color, f.size].filter(Boolean).join(' | '),
        barcode: f.barcode,
        purchasePrice: f.purchasePrice,
        sellingPrice: f.sellingPrice,
        stockQty: f.stockQty,
        lowStockAlert: f.lowStockAlert,
        status: stockStatus(f.stockQty, f.lowStockAlert),
        totalValue: Number(f.sellingPrice || 0) * Number(f.stockQty || 0),
      })),
      ...lenses.map(l => ({
        type: 'Lens',
        name: l.name,
        detail: [l.brand, l.lensType?.replace('_', ' '), l.lensIndex].filter(Boolean).join(' | '),
        barcode: l.barcode,
        purchasePrice: l.purchasePrice,
        sellingPrice: l.sellingPrice,
        stockQty: l.stockQty,
        lowStockAlert: l.lowStockAlert,
        status: stockStatus(l.stockQty, l.lowStockAlert),
        totalValue: Number(l.sellingPrice || 0) * Number(l.stockQty || 0),
      })),
      ...accessories.map(a => ({
        type: 'Accessory',
        name: a.name,
        detail: a.category,
        barcode: a.barcode,
        purchasePrice: a.purchasePrice,
        sellingPrice: a.sellingPrice,
        stockQty: a.stockQty,
        lowStockAlert: a.lowStockAlert,
        status: stockStatus(a.stockQty, a.lowStockAlert),
        totalValue: Number(a.sellingPrice || 0) * Number(a.stockQty || 0),
      })),
    ];

    const summary = rows.reduce((acc, item) => {
      acc.totalItems += 1;
      acc.totalUnits += Number(item.stockQty || 0);
      acc.totalValue += Number(item.totalValue || 0);
      if (item.status === 'Low Stock') acc.lowStock += 1;
      if (item.status === 'Out of Stock') acc.outOfStock += 1;
      return acc;
    }, { totalItems: 0, totalUnits: 0, totalValue: 0, lowStock: 0, outOfStock: 0 });

    const html = buildStockReportHtml({ store, rows, summary });
    const browser = await launchPdfBrowser();
    let pdf;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
    } finally {
      await browser.close();
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=stock-report-${stamp}.pdf`,
      'Content-Length': pdf.length,
    });
    return res.end(pdf);
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const [frames, lenses, accessories] = await Promise.all([
      prisma.frame.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { brand: 'asc' } }),
      prisma.lens.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { name: 'asc' } }),
      prisma.accessory.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({ success: true, data: { frames, lenses, accessories } });
  } catch (e) { next(e); }
});

router.get('/movements', async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const movements = await prisma.stockMovement.findMany({
      where: { storeId: req.storeId }, orderBy: { createdAt: 'desc' }, skip, take: Number(limit),
      include: { frame: { select: { brand: true, model: true, frameCode: true } }, lens: { select: { name: true } }, accessory: { select: { name: true } } }
    });
    res.json({ success: true, data: movements });
  } catch (e) { next(e); }
});

router.post('/adjust', requireAdmin, async (req, res, next) => {
  try {
    const { frameId, lensId, accessoryId, type, quantity, reason } = req.body;
    if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid movement type' });
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || (type !== 'ADJUSTMENT' && qty === 0)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a valid integer' });
    }
    const selectedCount = [frameId, lensId, accessoryId].filter(Boolean).length;
    if (selectedCount !== 1) {
      return res.status(400).json({ success: false, message: 'Select exactly one item' });
    }

    let item, idKey;
    if (frameId) {
      item = await prisma.frame.findFirst({ where: { id: frameId, storeId: req.storeId } });
      idKey = 'frameId';
    } else if (lensId) {
      item = await prisma.lens.findFirst({ where: { id: lensId, storeId: req.storeId } });
      idKey = 'lensId';
    } else if (accessoryId) {
      item = await prisma.accessory.findFirst({ where: { id: accessoryId, storeId: req.storeId } });
      idKey = 'accessoryId';
    }

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    const bef = item.stockQty;
    if (type === 'OUT' && qty > bef) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }
    const aft = type === 'IN' ? bef + qty : type === 'OUT' ? bef - qty : qty;
    const updateResult = idKey === 'frameId'
      ? await prisma.frame.updateMany({ where: { id: item.id, storeId: req.storeId }, data: { stockQty: aft } })
      : idKey === 'lensId'
        ? await prisma.lens.updateMany({ where: { id: item.id, storeId: req.storeId }, data: { stockQty: aft } })
        : await prisma.accessory.updateMany({ where: { id: item.id, storeId: req.storeId }, data: { stockQty: aft } });

    if (!updateResult.count) return res.status(404).json({ success: false, message: 'Item not found' });
    await prisma.stockMovement.create({ data: { storeId: req.storeId, [idKey]: item.id, type, quantity: Math.abs(aft - bef), beforeQty: bef, afterQty: aft, reason } });
    res.json({ success: true, data: { beforeQty: bef, afterQty: aft } });
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Stock Report - Excel Export (with audit workflow)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/stock-report/excel', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const XLSX = require('xlsx');
    const [frames, lenses, accessories] = await Promise.all([
      prisma.frame.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: [{ brand: 'asc' }, { model: 'asc' }] }),
      prisma.lens.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { name: 'asc' } }),
      prisma.accessory.findMany({ where: { storeId: req.storeId, isActive: true }, orderBy: { name: 'asc' } }),
    ]);

    // Prepare data for Excel
    const excelData = [
      ...frames.map(f => ({
        'Item Type': 'Frame',
        'ID': f.id,
        'Name': [f.brand, f.model].filter(Boolean).join(' ') || f.frameCode,
        'Brand': f.brand,
        'Model': f.model || '',
        'Barcode': f.barcode,
        'Current Stock': f.stockQty,
        'New Stock': f.stockQty,
        'Difference': 0,
        'Low Stock Alert': f.lowStockAlert,
        'Reason': '',
      })),
      ...lenses.map(l => ({
        'Item Type': 'Lens',
        'ID': l.id,
        'Name': l.name,
        'Brand': l.brand || '',
        'Model': l.lensIndex,
        'Barcode': l.barcode,
        'Current Stock': l.stockQty,
        'New Stock': l.stockQty,
        'Difference': 0,
        'Low Stock Alert': l.lowStockAlert,
        'Reason': '',
      })),
      ...accessories.map(a => ({
        'Item Type': 'Accessory',
        'ID': a.id,
        'Name': a.name,
        'Brand': a.category,
        'Model': '',
        'Barcode': a.barcode,
        'Current Stock': a.stockQty,
        'New Stock': a.stockQty,
        'Difference': 0,
        'Low Stock Alert': a.lowStockAlert,
        'Reason': '',
      })),
    ];

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Style the header row
    ws['!cols'] = [
      { wch: 12 }, // Item Type
      { hidden: true }, // ID (hidden)
      { wch: 25 }, // Name
      { wch: 12 }, // Brand
      { wch: 12 }, // Model
      { wch: 15 }, // Barcode
      { wch: 14 }, // Current Stock
      { wch: 14 }, // New Stock (editable)
      { wch: 12 }, // Difference
      { wch: 15 }, // Low Stock Alert
      { wch: 20 }, // Reason (editable)
    ];

    // Add data validation and formulas for difference column
    const startRow = 2;
    for (let i = 0; i < excelData.length; i++) {
      const rowNum = startRow + i;
      // Formula to calculate difference: New Stock - Current Stock
      ws[`I${rowNum}`] = { f: `H${rowNum}-G${rowNum}` };
    }

    // Freeze header and first column
    ws['!freeze'] = { xSplit: 2, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Audit');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const stamp = new Date().toISOString().slice(0, 10);
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=stock-audit-${stamp}.xlsx`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Audit Workflow - Submit Changes
// ═══════════════════════════════════════════════════════════════════════════

router.post('/audit/submit', requireAdmin, async (req, res, next) => {
  try {
    assertInventoryAuditClient();
    const userId = authenticatedUserId(req);
    const { items, notes } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items array required' });
    }

    const audit = await prisma.$transaction(async tx => {
      const rowsByItem = new Map();

      for (const rawItem of items) {
        const itemType = normalizeAuditItemType(rawItem.itemType);
        const itemId = String(rawItem.itemId || '').trim();
        const itemBarcode = String(rawItem.itemBarcode || '').trim();
        const oldQuantity = Number(rawItem.oldQuantity);
        const newQuantity = Number(rawItem.newQuantity);
        const difference = newQuantity - oldQuantity;

        if (!itemType || (!itemId && !itemBarcode) || !Number.isInteger(oldQuantity) || oldQuantity < 0 || !Number.isInteger(newQuantity) || newQuantity < 0) {
          throw Object.assign(new Error('Audit contains invalid item data'), { status: 400 });
        }

        if (difference === 0) continue;

        const inventoryItem = await selectAuditInventoryItem(tx, req.storeId, itemType, itemId, itemBarcode);
        if (!inventoryItem) {
          throw Object.assign(new Error(`Inventory item not found: ${rawItem.itemName || itemBarcode || itemId}`), { status: 404 });
        }

        rowsByItem.set(`${itemType}:${inventoryItem.id}`, {
          itemType,
          itemId: inventoryItem.id,
          itemName: inventoryItem.name,
          itemBarcode: inventoryItem.barcode || null,
          oldQuantity,
          newQuantity,
          difference,
          reason: rawItem.reason ? String(rawItem.reason).trim() : null,
        });
      }

      const validItems = [...rowsByItem.values()];
      if (validItems.length === 0) {
        throw Object.assign(new Error('No valid changes to submit'), { status: 400 });
      }

      return tx.inventoryAudit.create({
        data: {
          storeId: req.storeId,
          userId,
          notes: notes ? String(notes).trim() : null,
          items: {
            createMany: {
              data: validItems,
            },
          },
        },
        include: { items: true, user: { select: { name: true, email: true } } },
      });
    });

    res.json({
      success: true,
      data: {
        auditId: audit.id,
        itemsCount: audit.items.length,
        status: audit.status,
        message: `Audit submitted with ${audit.items.length} changes. Awaiting confirmation.`,
      },
    });
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Audit Workflow - Confirm & Apply Changes
// ═══════════════════════════════════════════════════════════════════════════

const confirmInventoryAudit = async (req, res, next) => {
  try {
    assertInventoryAuditClient();
    const userId = authenticatedUserId(req);
    const { auditId } = req.params;

    const applyResults = await prisma.$transaction(async tx => {
      const audit = await tx.inventoryAudit.findFirst({
        where: { id: auditId, storeId: req.storeId },
        include: { items: true },
      });

      if (!audit) throw Object.assign(new Error('Audit not found'), { status: 404 });
      if (audit.status !== 'PENDING') {
        throw Object.assign(new Error(`Cannot confirm a ${audit.status.toLowerCase()} audit`), { status: 400 });
      }

      const results = [];

      for (const auditItem of audit.items) {
        const itemType = normalizeAuditItemType(auditItem.itemType);
        const { itemId, oldQuantity, newQuantity, reason, difference } = auditItem;
        if (!itemType) {
          throw Object.assign(new Error(`Invalid audit item type for ${auditItem.itemName}`), { status: 400 });
        }

        const currentItem = await selectAuditInventoryItem(tx, req.storeId, itemType, itemId);

        if (!currentItem) {
          throw Object.assign(new Error(`Inventory item no longer exists: ${auditItem.itemName}`), { status: 404 });
        }

        if (currentItem.stockQty !== oldQuantity) {
          throw Object.assign(new Error(`Stock changed after audit submission for ${auditItem.itemName}. Current stock is ${currentItem.stockQty}.`), { status: 409 });
        }

        const updateResult = await updateAuditInventoryItem(tx, req.storeId, itemType, itemId, newQuantity);
        if (!updateResult.count) {
          throw Object.assign(new Error(`Unable to update inventory item: ${auditItem.itemName}`), { status: 404 });
        }

        await tx.stockMovement.create({
          data: {
            storeId: req.storeId,
            ...(itemType === 'FRAME' && { frameId: itemId }),
            ...(itemType === 'LENS' && { lensId: itemId }),
            ...(itemType === 'ACCESSORY' && { accessoryId: itemId }),
            type: difference > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(difference),
            beforeQty: oldQuantity,
            afterQty: newQuantity,
            reason: reason || `Stock Audit ${auditId.slice(0, 8)}`,
            reference: `AUDIT:${auditId}`,
          },
        });

        results.push({ itemId, success: true });
      }

      await tx.inventoryAudit.update({
        where: { id: auditId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmedById: userId,
        },
      });

      return results;
    });

    res.json({
      success: true,
      data: {
        auditId,
        itemsProcessed: applyResults.filter(r => r.success).length,
        totalItems: applyResults.length,
        results: applyResults,
        message: `Audit confirmed. ${applyResults.filter(r => r.success).length}/${applyResults.length} items updated.`,
      },
    });
  } catch (e) { next(e); }
};

router.post('/audit/:auditId/confirm', requireRole('SUPER_ADMIN'), confirmInventoryAudit);
router.post('/audits/:auditId/confirm', requireRole('SUPER_ADMIN'), confirmInventoryAudit);

// ═══════════════════════════════════════════════════════════════════════════
// Audit History - View & Filter
// ═══════════════════════════════════════════════════════════════════════════

router.get('/audits', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    assertInventoryAuditClient();
    const { page = 1, limit = 20, status, userId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { storeId: req.storeId };
    if (status && ['PENDING', 'CONFIRMED', 'REJECTED'].includes(status)) where.status = status;
    if (userId) where.userId = userId;

    const [audits, total] = await Promise.all([
      prisma.inventoryAudit.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { submittedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          confirmedBy: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),
      prisma.inventoryAudit.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        audits,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (e) { next(e); }
});

// Get single audit with details
router.get('/audits/:auditId', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    assertInventoryAuditClient();
    const { auditId } = req.params;

    const audit = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: req.storeId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        confirmedBy: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found' });

    res.json({ success: true, data: audit });
  } catch (e) { next(e); }
});

module.exports = router;
