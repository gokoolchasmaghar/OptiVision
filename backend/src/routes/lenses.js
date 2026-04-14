// routes/lenses.js
const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

const generateEAN13 = () => {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const checksum = digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (checksum % 10)) % 10;
  return [...digits, checkDigit].join('');
};

const generateUniqueBarcode = async () => {
  let barcode;
  let exists = true;

  while (exists) {
    barcode = generateEAN13();

    const found = await prisma.lens.findUnique({
      where: { barcode }
    });

    exists = !!found;
  }

  return barcode;
};

const generateSKU = () => {
  return 'LENS-' + Math.floor(100000 + Math.random() * 900000);
};

router.get('/', async (req, res, next) => {
  try {
    const { lensType, search } = req.query;
    const lenses = await prisma.lens.findMany({ where: { storeId: req.storeId, isActive: true, ...(lensType && { lensType }), ...(search && { name: { contains: search, mode: 'insensitive' } }) }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: lenses });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
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
      barcode
    } = req.body;

    // Barcode logic
    const finalBarcode =
      barcode && String(barcode).trim() !== ''
        ? String(barcode)
        : await generateUniqueBarcode();

    // SKU logic
    const finalSKU = generateSKU();

    // Create lens
    const lens = await prisma.lens.create({
      data: {
        storeId: req.storeId,
        name,
        lensType: lensType || 'SINGLE_VISION',
        lensIndex: lensIndex || '1.56',
        coating: coating || [],
        brand,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
        stockQty: Number(stockQty) || 100,
        lowStockAlert: Number(lowStockAlert) || 10,
        supplierId,
        barcode: finalBarcode,
        sku: finalSKU
      }
    });

    // Send response
    res.status(201).json({ success: true, data: lens });

  } catch (e) {
    console.error("LENS CREATE ERROR:", e);
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const lens = await prisma.lens.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: lens });
  } catch (e) { next(e); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.lens.update({ where: { id: req.params.id }, data: { isActive: false } });
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
