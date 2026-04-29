const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /accessories
exports.getAccessories = async (req, res) => {
  try {
    const { search = '', category } = req.query;
    const storeId = req.user.storeId;

    const data = await prisma.accessory.findMany({
      where: {
        storeId,
        isActive: true,
        ...(category && category !== 'ALL' ? { category } : {}),
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

    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch accessories' });
  }
};

// POST /accessories
exports.createAccessory = async (req, res) => {
  try {
    const storeId = req.user.storeId;

    const {
      name,
      category,
      purchasePrice,
      sellingPrice,
      stockQty,
      barcode,
      modelCode,
    } = req.body;

    // ✅ Basic validation
    if (!name || !sellingPrice) {
      return res.status(400).json({ message: 'Name and selling price required' });
    }

    // 🔥 Auto-generate SKU
    const generatedSKU = barcode
      ? `ACC-${barcode}`
      : `ACC-${Date.now()}`;

    const item = await prisma.accessory.create({
      data: {
        storeId,
        name,
        category,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
        stockQty: Number(stockQty) || 0,
        barcode,
        sku: generatedSKU,
        modelCode,
      },
    });

    res.json({ data: item });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Create failed' });
  }
};

// PUT /accessories/:id
exports.updateAccessory = async (req, res) => {
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

    const updated = await prisma.accessory.update({
      where: { id },
      data: {
        name,
        category,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice),
        stockQty: Number(stockQty) || 0,
        lowStockAlert: Number(lowStockAlert) || 5,

        // ✅ IMPORTANT FIX
        ...(barcode ? { barcode } : {}),

        modelCode,
      },
    });

    res.json({ data: updated });
  } catch (err) {
    console.error(err); // 👈 ADD THIS FOR DEBUG
    res.status(500).json({ message: err.message || 'Update failed' });
  }
};

// DELETE /accessories/:id (soft delete)
exports.deleteAccessory = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.accessory.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
};