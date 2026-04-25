const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    // 🔍 FRAME
    let product = await prisma.frame.findFirst({
      where: {
        barcode: code,
        storeId: req.storeId,
        isActive: true
      }
    });

    if (product) {
      return res.json({
        success: true,
        type: "FRAME",
        data: product
      });
    }

    // 🔍 LENS
    product = await prisma.lens.findFirst({
      where: {
        barcode: code,
        storeId: req.storeId,
        isActive: true
      }
    });

    if (product) {
      return res.json({
        success: true,
        type: "LENS",
        data: product
      });
    }

    // 🔍 ACCESSORY (optional)
    product = await prisma.accessory.findFirst({
      where: {
        barcode: code,
        storeId: req.storeId,
        isActive: true
      }
    });

    if (product) {
      return res.json({
        success: true,
        type: "ACCESSORY",
        data: product
      });
    }

    // 🔍 ORDER
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: code,
        storeId: req.storeId,
      },
    });

    if (order) {
      return res.json({
        success: true,
        type: "ORDER",
        data: order,
      });
    }

    return res.status(404).json({
      success: false,
      message: "Product not found"
    });

  } catch (e) {
    console.error("BARCODE ERROR:", e);
    next(e);
  }
});

module.exports = router;