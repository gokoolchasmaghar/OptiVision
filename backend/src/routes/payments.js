const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);
router.get('/order/:orderId', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, storeId: req.storeId },
      select: { id: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const payments = await prisma.payment.findMany({
      where: { orderId: req.params.orderId },
      orderBy: { paidAt: 'asc' }
    });
    res.json({ success: true, data: payments });
  } catch (e) { next(e); }
});
module.exports = router;
