const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const accessories = await prisma.accessory.findMany({
      where: { storeId: req.storeId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: accessories });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, category, purchasePrice, sellingPrice, stockQty, lowStockAlert, barcode } = req.body;
    const accessory = await prisma.accessory.create({
      data: {
        storeId: req.storeId,
        name,
        category,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
        stockQty: Number(stockQty) || 0,
        lowStockAlert: Number(lowStockAlert) || 5,
        barcode,
      },
    });
    res.status(201).json({ success: true, data: accessory });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { storeId, id, createdAt, updatedAt, ...safeData } = req.body;
    const result = await prisma.accessory.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: safeData,
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Not found' });

    const accessory = await prisma.accessory.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
    });
    res.json({ success: true, data: accessory });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await prisma.accessory.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: { isActive: false },
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
