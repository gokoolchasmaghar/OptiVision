const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { storeId: req.storeId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: suppliers });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, phone, email, address, gstNumber } = req.body;
    const supplier = await prisma.supplier.create({
      data: { storeId: req.storeId, name, phone, email, address, gstNumber },
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { storeId, id, createdAt, updatedAt, ...safeData } = req.body;
    const result = await prisma.supplier.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: safeData,
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Not found' });

    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
    });
    res.json({ success: true, data: supplier });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await prisma.supplier.updateMany({
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
