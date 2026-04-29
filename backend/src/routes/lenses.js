// routes/lenses.js
const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { resolveBarcode } = require('../utils/barcode');
const { resolveSku } = require('../utils/sku');
const { LENS_TYPES, enumValue, numberOrDefault } = require('../utils/normalize');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { lensType, search } = req.query;
    const finalLensType = enumValue(lensType, LENS_TYPES);
    const lenses = await prisma.lens.findMany({ where: { storeId: req.storeId, isActive: true, ...(finalLensType && { lensType: finalLensType }), ...(search && { name: { contains: search, mode: 'insensitive' } }) }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: lenses });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const {
      name,
      lensType,
      lensIndex,
      coating,
      brand,
      purchasePrice,
      sellingPrice,
      stockQty,
      lowStockAlert,
      supplierId,
      barcode,
      sku
    } = req.body;

    let resolvedSupplierId = null;
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, storeId: req.storeId, isActive: true },
        select: { id: true },
      });
      if (!supplier) {
        return res.status(400).json({ success: false, message: 'Invalid supplier for this store' });
      }
      resolvedSupplierId = supplier.id;
    }

    const finalBarcode = await resolveBarcode(prisma, barcode);
    const finalSku = await resolveSku(prisma, 'lens', 'LENS', sku);
    const finalLensType = enumValue(lensType, LENS_TYPES, 'SINGLE_VISION');

    const lens = await prisma.lens.create({
      data: {
        storeId: req.storeId,
        name,
        lensType: finalLensType,
        lensIndex: lensIndex || '1.56',
        coating: Array.isArray(coating) ? coating : [],
        brand,
        purchasePrice: numberOrDefault(purchasePrice, 0),
        sellingPrice: numberOrDefault(sellingPrice, 0),
        stockQty: numberOrDefault(stockQty, 100),
        lowStockAlert: numberOrDefault(lowStockAlert, 10),
        supplierId: resolvedSupplierId,
        barcode: finalBarcode,
        sku: finalSku
      }
    });
    if (numberOrDefault(stockQty, 100) > 0) {
      await prisma.stockMovement.create({
        data: {
          storeId: req.storeId,
          lensId: lens.id,
          type: 'IN',
          quantity: numberOrDefault(stockQty, 100),
          beforeQty: 0,
          afterQty: numberOrDefault(stockQty, 100),
          reason: 'Initial stock',
        }
      });
    }

    // Send response
    res.status(201).json({ success: true, data: lens });

  } catch (e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { storeId, id, createdAt, updatedAt, barcode, sku, lensType, coating, supplierId, purchasePrice, sellingPrice, stockQty, lowStockAlert, ...safeData } = req.body;
    if (barcode !== undefined) {
      safeData.barcode = await resolveBarcode(prisma, barcode, new Set(), { model: 'lens', id: req.params.id });
    }
    if (sku !== undefined) {
      safeData.sku = await resolveSku(prisma, 'lens', 'LENS', sku, req.params.id);
    }
    if (lensType !== undefined) {
      safeData.lensType = enumValue(lensType, LENS_TYPES, 'SINGLE_VISION');
    }
    if (coating !== undefined) {
      safeData.coating = Array.isArray(coating) ? coating : [];
    }
    if (supplierId !== undefined) {
      if (supplierId) {
        const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId: req.storeId, isActive: true }, select: { id: true } });
        if (!supplier) return res.status(400).json({ success: false, message: 'Invalid supplier for this store' });
      }
      safeData.supplierId = supplierId || null;
    }
    if (purchasePrice !== undefined) safeData.purchasePrice = numberOrDefault(purchasePrice, 0);
    if (sellingPrice !== undefined) safeData.sellingPrice = numberOrDefault(sellingPrice, 0);
    const existing = stockQty !== undefined
      ? await prisma.lens.findFirst({ where: { id: req.params.id, storeId: req.storeId }, select: { id: true, stockQty: true } })
      : null;
    if (stockQty !== undefined) safeData.stockQty = numberOrDefault(stockQty, 0);
    if (lowStockAlert !== undefined) safeData.lowStockAlert = numberOrDefault(lowStockAlert, 10);

    const result = await prisma.lens.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: safeData
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Not found' });
    if (stockQty !== undefined && existing && existing.stockQty !== safeData.stockQty) {
      await prisma.stockMovement.create({
        data: {
          storeId: req.storeId,
          lensId: req.params.id,
          type: 'ADJUSTMENT',
          quantity: Math.abs(safeData.stockQty - existing.stockQty),
          beforeQty: existing.stockQty,
          afterQty: safeData.stockQty,
          reason: 'Lens updated',
        }
      });
    }
    const lens = await prisma.lens.findFirst({ where: { id: req.params.id, storeId: req.storeId } });
    res.json({ success: true, data: lens });
  } catch (e) { next(e); }
});
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await prisma.lens.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: { isActive: false }
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get('/barcode/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    const item = await prisma[req.baseUrl.includes('lenses') ? 'lens' : 'frame']
      .findFirst({
        where: {
          barcode: code,
          storeId: req.storeId,
          isActive: true
        }
      });

    if (!item) {
      return res.json({ success: false, message: 'Not found' });
    }

    res.json({ success: true, data: item });

  } catch (e) {
    next(e);
  }
});
module.exports = router;
