const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireStaff } = require('../middleware/auth');

router.use(authenticate);
router.use(requireStaff);

router.get('/order/:orderId', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, storeId: req.storeId },
      select: { id: true },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let payments = await prisma.payment.findMany({
      where: { orderId: req.params.orderId },
      orderBy: { paidAt: 'asc' }
    });

    // 🔒 Hide sensitive info from STAFF
    if (req.user.role === 'STAFF') {
      payments = payments.map(p => ({
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt
      }));
    }
    res.json({ success: true, data: payments });
  } catch (e) { next(e); }
});
module.exports = router;
