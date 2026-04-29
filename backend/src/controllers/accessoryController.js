const prisma = require('../utils/prisma');
const { resolveBarcode } = require('../utils/barcode');
const { resolveSku } = require('../utils/sku');
const { ACCESSORY_CATEGORIES, enumValue, numberOrDefault } = require('../utils/normalize');

exports.getAccessories = async (req, res, next) => {
  try {
    const { search = '', category } = req.query;
    const finalCategory = enumValue(category, ACCESSORY_CATEGORIES);

    const data = await prisma.accessory.findMany({
      where: {
        storeId: req.storeId,
        isActive: true,
        ...(finalCategory && category !== 'ALL' ? { category: finalCategory } : {}),
        ...(search
          ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.createAccessory = async (req, res, next) => {
  try {
    const {
      name,
      category,
      purchasePrice,
      sellingPrice,
      stockQty,
      lowStockAlert,
      barcode,
      sku,
      modelCode,
    } = req.body;

    if (!name || sellingPrice === undefined || sellingPrice === '') {
      return res.status(400).json({ success: false, message: 'Name and selling price required' });
    }

    const finalBarcode = await resolveBarcode(prisma, barcode);
    const finalSku = await resolveSku(prisma, 'accessory', 'ACC', sku);
    const finalCategory = enumValue(category, ACCESSORY_CATEGORIES, 'OTHER');

    const item = await prisma.accessory.create({
      data: {
        storeId: req.storeId,
        name,
        category: finalCategory,
        purchasePrice: numberOrDefault(purchasePrice, 0),
        sellingPrice: numberOrDefault(sellingPrice, 0),
        stockQty: numberOrDefault(stockQty, 0),
        lowStockAlert: numberOrDefault(lowStockAlert, 5),
        barcode: finalBarcode,
        sku: finalSku,
        modelCode,
      },
    });
    if (numberOrDefault(stockQty, 0) > 0) {
      await prisma.stockMovement.create({
        data: {
          storeId: req.storeId,
          accessoryId: item.id,
          type: 'IN',
          quantity: numberOrDefault(stockQty, 0),
          beforeQty: 0,
          afterQty: numberOrDefault(stockQty, 0),
          reason: 'Initial stock',
        }
      });
    }

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
};

exports.updateAccessory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      purchasePrice,
      sellingPrice,
      stockQty,
      lowStockAlert,
      barcode,
      sku,
      modelCode,
    } = req.body;

    const existing = await prisma.accessory.findFirst({
      where: { id, storeId: req.storeId },
      select: { id: true, stockQty: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Accessory not found' });

    const finalBarcode = barcode !== undefined
      ? await resolveBarcode(prisma, barcode, new Set(), { model: 'accessory', id })
      : undefined;
    const finalSku = sku !== undefined
      ? await resolveSku(prisma, 'accessory', 'ACC', sku, id)
      : undefined;
    const finalCategory = category !== undefined
      ? enumValue(category, ACCESSORY_CATEGORIES, 'OTHER')
      : undefined;

    const updated = await prisma.accessory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(finalCategory !== undefined && { category: finalCategory }),
        ...(purchasePrice !== undefined && { purchasePrice: numberOrDefault(purchasePrice, 0) }),
        ...(sellingPrice !== undefined && { sellingPrice: numberOrDefault(sellingPrice, 0) }),
        ...(stockQty !== undefined && { stockQty: numberOrDefault(stockQty, 0) }),
        ...(lowStockAlert !== undefined && { lowStockAlert: numberOrDefault(lowStockAlert, 5) }),
        ...(finalBarcode !== undefined && { barcode: finalBarcode }),
        ...(finalSku !== undefined && { sku: finalSku }),
        ...(modelCode !== undefined && { modelCode }),
      },
    });
    if (stockQty !== undefined && existing.stockQty !== updated.stockQty) {
      await prisma.stockMovement.create({
        data: {
          storeId: req.storeId,
          accessoryId: id,
          type: 'ADJUSTMENT',
          quantity: Math.abs(updated.stockQty - existing.stockQty),
          beforeQty: existing.stockQty,
          afterQty: updated.stockQty,
          reason: 'Accessory updated',
        }
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteAccessory = async (req, res, next) => {
  try {
    const result = await prisma.accessory.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: { isActive: false },
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'Accessory not found' });

    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
