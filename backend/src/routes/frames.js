const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

const generateEAN13 = () => {
  const base = Math.floor(100000000000 + Math.random() * 900000000000).toString();
  const digits = base.split('').map(Number);
  let sum = 0;

  digits.forEach((num, i) => {
    sum += i % 2 === 0 ? num : num * 3;
  });

  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
};

const generateSKU = () => {
  return `SKU-${Date.now()}`;
};

router.get('/', async (req, res, next) => {
  try {
    const { search, brand, shape, color, gender, lowStock, page = 1, limit = 20, minPrice, maxPrice } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      storeId: req.storeId, isActive: true,
      ...(search && { OR: [{ brand: { contains: search, mode: 'insensitive' } }, { model: { contains: search, mode: 'insensitive' } }, { frameCode: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search } }] }),
      ...(brand && { brand: { equals: brand, mode: 'insensitive' } }),
      ...(shape && { shape }),
      ...(color && { color: { contains: color, mode: 'insensitive' } }),
      ...(gender && { gender: { equals: gender, mode: 'insensitive' } }),
      ...(minPrice && { sellingPrice: { gte: Number(minPrice) } }),
      ...(maxPrice && { sellingPrice: { ...(minPrice ? { gte: Number(minPrice) } : {}), lte: Number(maxPrice) } }),
    };
    const [frames, total, brands] = await Promise.all([
      prisma.frame.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.frame.count({ where }),
      prisma.frame.findMany({ where: { storeId: req.storeId, isActive: true }, distinct: ['brand'], select: { brand: true }, orderBy: { brand: 'asc' } })
    ]);
    res.json({ success: true, data: frames, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }, filters: { brands: brands.map(b => b.brand) } });
  } catch (e) { next(e); }
});

router.get('/barcode/:barcode', async (req, res, next) => {
  try {
    const frame = await prisma.frame.findFirst({ where: { barcode: req.params.barcode, storeId: req.storeId, isActive: true } });
    if (!frame) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: frame });
  } catch (e) { next(e); }
});

router.get('/low-stock', async (req, res, next) => {
  try {
    const frames = await prisma.$queryRaw`SELECT id, brand, model, "frameCode", "stockQty", "lowStockAlert", "sellingPrice" FROM frames WHERE "storeId" = ${req.storeId} AND "isActive" = true AND "stockQty" <= "lowStockAlert" ORDER BY "stockQty" ASC LIMIT 20`;
    res.json({ success: true, data: frames });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const frame = await prisma.frame.findFirst({ where: { id: req.params.id, storeId: req.storeId }, include: { supplier: { select: { id: true, name: true } }, stockLogs: { take: 10, orderBy: { createdAt: 'desc' } } } });
    if (!frame) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: frame });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { brand, model, shape, size, color, material, gender, purchasePrice, sellingPrice, stockQty, lowStockAlert, barcode, imageUrl, supplierId, frameCode, modelCode } = req.body;
    if (!brand || !sellingPrice) return res.status(400).json({ success: false, message: 'brand and sellingPrice required' });
    let resolvedSupplierId = null;
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, storeId: req.storeId, isActive: true },
        select: { id: true },
      });
      if (!supplier) return res.status(400).json({ success: false, message: 'Invalid supplier for this store' });
      resolvedSupplierId = supplier.id;
    }

    const frame = await prisma.frame.create({
      data: { storeId: req.storeId, frameCode: frameCode || `FRM-${Date.now()}`, modelCode: modelCode || `MDL-${Date.now()}`, brand, model, shape: shape || 'RECTANGLE', size, color, material, gender, purchasePrice: Number(purchasePrice) || 0, sellingPrice: Number(sellingPrice), stockQty: Number(stockQty) || 0, lowStockAlert: Number(lowStockAlert) || 5,  barcode: barcode || generateEAN13(), sku: generateSKU(), imageUrl, supplierId: resolvedSupplierId }
    });
    if (Number(stockQty) > 0) {
      await prisma.stockMovement.create({ data: { storeId: req.storeId, frameId: frame.id, type: 'IN', quantity: Number(stockQty), beforeQty: 0, afterQty: Number(stockQty), reason: 'Initial stock' } });
    }
    res.status(201).json({ success: true, data: frame });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id, storeId, createdAt, updatedAt, ...safeData } = req.body;
    const r = await prisma.frame.updateMany({ where: { id: req.params.id, storeId: req.storeId }, data: safeData });
    if (!r.count) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await prisma.frame.findFirst({ where: { id: req.params.id, storeId: req.storeId } }) });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.frame.updateMany({ where: { id: req.params.id, storeId: req.storeId }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
