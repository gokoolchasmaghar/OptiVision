const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { positiveInt, numberOrDefault } = require('../utils/normalize');
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const purchases = await prisma.purchase.findMany({ where: { storeId: req.storeId }, orderBy: { purchasedAt: 'desc' }, include: { supplier: { select: { name: true } }, items: true } });
    res.json({ success: true, data: purchases });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { supplierId, invoiceNumber, items, notes, purchasedAt } = req.body;
    if (!supplierId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'supplierId and items are required' });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId: req.storeId, isActive: true },
      select: { id: true },
    });
    if (!supplier) return res.status(400).json({ success: false, message: 'Invalid supplier for this store' });

    const normalizedItems = items.map(i => ({
      ...i,
      quantity: positiveInt(i.quantity),
      unitCost: numberOrDefault(i.unitCost, 0),
    }));
    if (normalizedItems.some(i => !i.quantity || i.unitCost < 0 || !['frame', 'lens', 'accessory'].includes(i.itemType) || !i.itemId || !i.itemName)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase items' });
    }

    const totalAmount = normalizedItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const purchase = await prisma.$transaction(async tx => {
      const p = await tx.purchase.create({
        data: {
          storeId: req.storeId,
          supplierId,
          invoiceNumber,
          totalAmount,
          notes,
          purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
              items: {
            create: normalizedItems.map(i => ({
              itemType: i.itemType,
              itemId: i.itemId,
              itemName: i.itemName,
              quantity: i.quantity,
              unitCost: i.unitCost,
              totalCost: i.quantity * i.unitCost
            }))
          }
        },
        include: { items: true }
      });
      for (const item of normalizedItems) {
        if (item.itemType === 'frame' && item.itemId) {
          const f = await tx.frame.findFirst({ where: { id: item.itemId, storeId: req.storeId } });
          if (f) {
            await tx.frame.updateMany({
              where: { id: item.itemId, storeId: req.storeId },
              data: { stockQty: { increment: item.quantity }, purchasePrice: item.unitCost }
            });
            await tx.stockMovement.create({ data: { storeId: req.storeId, frameId: item.itemId, type: 'IN', quantity: item.quantity, beforeQty: f.stockQty, afterQty: f.stockQty + item.quantity, reason: 'Purchase', reference: invoiceNumber || p.id } });
          } else {
            throw Object.assign(new Error(`Frame not found: ${item.itemName}`), { status: 400 });
          }
        } else if (item.itemType === 'lens' && item.itemId) {
          const l = await tx.lens.findFirst({ where: { id: item.itemId, storeId: req.storeId } });
          if (l) {
            await tx.lens.updateMany({
              where: { id: item.itemId, storeId: req.storeId },
              data: { stockQty: { increment: item.quantity } }
            });
            await tx.stockMovement.create({ data: { storeId: req.storeId, lensId: item.itemId, type: 'IN', quantity: item.quantity, beforeQty: l.stockQty, afterQty: l.stockQty + item.quantity, reason: 'Purchase', reference: invoiceNumber || p.id } });
          } else {
            throw Object.assign(new Error(`Lens not found: ${item.itemName}`), { status: 400 });
          }
        } else if (item.itemType === 'accessory' && item.itemId) {
          const a = await tx.accessory.findFirst({ where: { id: item.itemId, storeId: req.storeId } });
          if (a) {
            await tx.accessory.updateMany({
              where: { id: item.itemId, storeId: req.storeId },
              data: { stockQty: { increment: item.quantity } }
            });
            await tx.stockMovement.create({
              data: {
                storeId: req.storeId,
                accessoryId: item.itemId,
                type: 'IN',
                quantity: item.quantity,
                beforeQty: a.stockQty,
                afterQty: a.stockQty + item.quantity,
                reason: 'Purchase',
                reference: invoiceNumber || p.id
              }
            });
          } else {
            throw Object.assign(new Error(`Accessory not found: ${item.itemName}`), { status: 400 });
          }
        }
      }
      return p;
    });
    res.status(201).json({ success: true, data: purchase });
  } catch (e) { next(e); }
});

module.exports = router;
