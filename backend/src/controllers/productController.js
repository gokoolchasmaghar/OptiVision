const prisma = require('../utils/prisma');

exports.scanProduct = async (req, res, next) => {
  const { barcode } = req.params;
  const storeId = req.storeId; // must exist via middleware

  try {
    const frame = await prisma.frame.findFirst({
      where: { barcode, storeId, isActive: true }
    });
    if (frame) return res.json({ success: true, type: "frame", data: frame });

    const lens = await prisma.lens.findFirst({
      where: { barcode, storeId, isActive: true }
    });
    if (lens) return res.json({ success: true, type: "lens", data: lens });

    const accessory = await prisma.accessory.findFirst({
      where: { barcode, storeId, isActive: true }
    });
    if (accessory) return res.json({ success: true, type: "accessory", data: accessory });

    return res.status(404).json({ success: false, message: "Product not found" });

  } catch (err) {
    next(err);
  }
};
