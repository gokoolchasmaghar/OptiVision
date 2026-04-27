const prisma = require('../utils/prisma');

exports.scanProduct = async (req, res) => {
  const { barcode } = req.params;
  const storeId = req.storeId; // must exist via middleware

  try {
    const frame = await prisma.frame.findFirst({
      where: { barcode, storeId }
    });
    if (frame) return res.json({ type: "frame", data: frame });

    const lens = await prisma.lens.findFirst({
      where: { barcode, storeId }
    });
    if (lens) return res.json({ type: "lens", data: lens });

    const accessory = await prisma.accessory.findFirst({
      where: { barcode, storeId }
    });
    if (accessory) return res.json({ type: "accessory", data: accessory });

    return res.status(404).json({ error: "Product not found" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};