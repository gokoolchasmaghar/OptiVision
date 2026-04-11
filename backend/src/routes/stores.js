const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
router.use(authenticate);
router.get('/current', async (req, res, next) => { try { const s = await prisma.store.findUnique({ where: { id: req.storeId } }); res.json({ success: true, data: s }); } catch (e) { next(e); } });
router.put('/current', requireAdmin, async (req, res, next) => {
  try {
    const { name, address, phone, email, gstNumber, gstEnabled, taxRate, invoicePrefix } = req.body;
    const s = await prisma.store.update({
      where: { id: req.storeId },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(gstNumber !== undefined && { gstNumber }),
        ...(gstEnabled !== undefined && { gstEnabled: gstEnabled === true || gstEnabled === 'true' }),
        ...(taxRate !== undefined && { taxRate: Number(taxRate) }),
        ...(invoicePrefix && { invoicePrefix })
      }
    });
    res.json({ success: true, data: s });
  } catch (e) { next(e); }
});
module.exports = router;
