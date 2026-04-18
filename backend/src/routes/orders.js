const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateInvoice } = require('../controllers/invoice');

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { status, customerId, search, page = 1, limit = 20, dateFrom, dateTo } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      storeId: req.storeId,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(search && { OR: [{ orderNumber: { contains: search, mode: 'insensitive' } }, { customer: { name: { contains: search, mode: 'insensitive' } } }, { customer: { phone: { contains: search } } }] }),
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), lte: new Date(dateTo + 'T23:59:59') } }),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { customer: { select: { id: true, name: true, phone: true } }, staff: { select: { id: true, name: true } }, items: true, payments: true } }),
      prisma.order.count({ where })
    ]);
    res.json({ success: true, data: orders, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      include: {
        customer: true, prescription: true,
        staff: { select: { id: true, name: true, role: true } },
        items: { include: { frame: { select: { id: true, brand: true, model: true, imageUrl: true } }, lens: { select: { id: true, name: true } } } },
        payments: { orderBy: { paidAt: 'asc' } },
        statusLogs: { orderBy: { changedAt: 'asc' } }
      }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});

router.get('/:id/invoice', authenticate, generateInvoice);

router.post('/', async (req, res, next) => {
  try {
    const { customerId, prescriptionId, items, discountAmount = 0, advanceAmount = 0, paymentMethod = 'CASH', deliveryDate, frameDetails, lensDetails, notes, redeemPoints = 0 } = req.body;
    if (!customerId || !items?.length) return res.status(400).json({ success: false, message: 'customerId and items are required' });

    const store = await prisma.store.findUnique({ where: { id: req.storeId } });
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, storeId: req.storeId },
      select: { id: true },
    });
    if (!customer) return res.status(400).json({ success: false, message: 'Invalid customer for this store' });

    if (prescriptionId) {
      const prescription = await prisma.prescription.findFirst({
        where: { id: prescriptionId, customerId, customer: { storeId: req.storeId } },
        select: { id: true },
      });
      if (!prescription) return res.status(400).json({ success: false, message: 'Invalid prescription for this customer' });
    }

    const calculatedSubtotal = roundMoney(items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0));
    const safeDiscount = Math.min(Math.max(roundMoney(discountAmount), 0), calculatedSubtotal);
    const loyaltyUsed = Number(redeemPoints || 0);
    const taxableAmount = calculatedSubtotal - safeDiscount;
    const effectiveTaxRate = store.gstEnabled ? Math.max(0, Number(store.taxRate) || 0) : 0;
    const calculatedTax = roundMoney((taxableAmount * effectiveTaxRate) / 100);
    const calculatedTotal = roundMoney(taxableAmount + calculatedTax);

    if (calculatedTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Order total must be greater than zero' });
    }

    const orderNumber = `${store.invoicePrefix}-${String(store.invoiceCounter + 1).padStart(4, '0')}`;

    const order = await prisma.$transaction(async tx => {
      for (const item of items) {
        if (item.itemType === 'frame' && item.frameId) {
          const frame = await tx.frame.findFirst({
            where: { id: item.frameId, storeId: req.storeId, isActive: true }
          });
          if (!frame || frame.stockQty < item.quantity) throw Object.assign(new Error(`Insufficient stock: ${frame?.brand || 'frame'}`), { status: 400 });
          const bef = frame.stockQty;
          await tx.frame.updateMany({
            where: { id: item.frameId, storeId: req.storeId },
            data: { stockQty: { decrement: item.quantity } }
          });
          await tx.stockMovement.create({ data: { storeId: req.storeId, frameId: item.frameId, type: 'OUT', quantity: item.quantity, beforeQty: bef, afterQty: bef - item.quantity, reason: 'Order', reference: orderNumber } });
        }
        if (item.itemType === 'lens' && item.lensId) {
          const lens = await tx.lens.findFirst({
            where: { id: item.lensId, storeId: req.storeId, isActive: true }
          });
          if (lens && lens.stockQty >= item.quantity) {
            const bef = lens.stockQty;
            await tx.lens.updateMany({
              where: { id: item.lensId, storeId: req.storeId },
              data: { stockQty: { decrement: item.quantity } }
            });
            await tx.stockMovement.create({ data: { storeId: req.storeId, lensId: item.lensId, type: 'OUT', quantity: item.quantity, beforeQty: bef, afterQty: bef - item.quantity, reason: 'Order', reference: orderNumber } });
          }
        }
      }

      const newOrder = await tx.order.create({
        data: {
          storeId: req.storeId, orderNumber, customerId, prescriptionId: prescriptionId || null, staffId: req.user.id,
          subtotal: calculatedSubtotal, discountAmount: safeDiscount, redeemPoints: Number(redeemPoints || 0), taxAmount: calculatedTax, taxPct: effectiveTaxRate, totalAmount: calculatedTotal,
          advanceAmount: Number(advanceAmount), balanceAmount: Math.max(0, calculatedTotal - Number(advanceAmount)),
          paymentMethod, paymentStatus: Number(advanceAmount) >= calculatedTotal ? 'PAID' : Number(advanceAmount) > 0 ? 'PARTIAL' : 'PENDING',
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null, frameDetails, lensDetails, notes,
          items: { create: items.map(i => ({ itemType: i.itemType, frameId: i.frameId || null, lensId: i.lensId || null, accessoryId: i.accessoryId || null, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })) },
          statusLogs: { create: { status: 'CREATED', note: 'Order created' } },
          ...(Number(advanceAmount) > 0 ? { payments: { create: [{ amount: Number(advanceAmount), method: paymentMethod, note: 'Advance' }] } } : {})
        },
        include: { customer: true, items: true }
      });

      // 🔥 LOYALTY LOGIC START

      const earnedPoints = Math.floor(newOrder.totalAmount / 100);

      // update customer points
      const customerUpdate = await tx.customer.updateMany({
        where: { id: customerId, storeId: req.storeId },
        data: {
          loyaltyPoints: {
            increment: earnedPoints - Number(redeemPoints || 0)
          }
        }
      });
      if (!customerUpdate.count) throw Object.assign(new Error('Customer not found'), { status: 404 });

      // 🔥 LOYALTY LOGIC END

      await tx.store.update({
        where: { id: req.storeId },
        data: { invoiceCounter: { increment: 1 } }
      });

      return newOrder;
    });

    res.status(201).json({ success: true, data: order });
  } catch (e) { next(e); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const valid = ['CREATED', 'LENS_ORDERED', 'GRINDING', 'FITTING', 'READY', 'DELIVERED', 'CANCELLED'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

    const order = await prisma.$transaction(async tx => {
      const result = await tx.order.updateMany({
        where: { id: req.params.id, storeId: req.storeId },
        data: { status, ...(status === 'DELIVERED' && { deliveredAt: new Date() }), ...(status === 'CANCELLED' && { cancelledAt: new Date(), cancelReason: note }) }
      });
      if (!result.count) throw Object.assign(new Error('Order not found'), { status: 404 });
      await tx.orderStatusLog.create({ data: { orderId: req.params.id, status, note } });
      return tx.order.findFirst({ where: { id: req.params.id, storeId: req.storeId } });
    });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});

router.post('/:id/payment', async (req, res, next) => {
  try {
    const { amount, method, reference, note } = req.body;
    if (Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });

    const order = await prisma.order.findFirst({ where: { id: req.params.id, storeId: req.storeId } });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    await prisma.$transaction(async tx => {
      await tx.payment.create({ data: { orderId: req.params.id, amount: Number(amount), method, reference, note } });
      const agg = await tx.payment.aggregate({ where: { orderId: req.params.id }, _sum: { amount: true } });
      const paid = agg._sum.amount || 0;
      const result = await tx.order.updateMany({
        where: { id: req.params.id, storeId: req.storeId },
        data: { advanceAmount: paid, balanceAmount: Math.max(0, order.totalAmount - paid), paymentStatus: paid >= order.totalAmount ? 'PAID' : 'PARTIAL' }
      });
      if (!result.count) throw Object.assign(new Error('Order not found'), { status: 404 });
    });
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // ❌ Restrict delete after READY
    if (['READY', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({
        message: "Cannot delete order after READY stage"
      });
    }

    await prisma.$transaction(async tx => {
      for (const item of order.items) {
        // 🟦 FRAME
        if (item.frameId) {
          const frame = await tx.frame.findFirst({
            where: { id: item.frameId, storeId: req.storeId }
          });
          if (!frame) continue;

          await tx.frame.updateMany({
            where: { id: item.frameId, storeId: req.storeId },
            data: {
              stockQty: { increment: item.quantity }
            }
          });

          await tx.stockMovement.create({
            data: {
              storeId: req.storeId,
              frameId: item.frameId,
              type: 'IN',
              quantity: item.quantity,
              beforeQty: frame.stockQty,
              afterQty: frame.stockQty + item.quantity,
              reason: 'Order Cancel',
              reference: order.orderNumber
            }
          });
        }

        // 🟨 LENS
        else if (item.lensId) {
          const lens = await tx.lens.findFirst({
            where: { id: item.lensId, storeId: req.storeId }
          });
          if (!lens) continue;

          await tx.lens.updateMany({
            where: { id: item.lensId, storeId: req.storeId },
            data: {
              stockQty: { increment: item.quantity }
            }
          });

          await tx.stockMovement.create({
            data: {
              storeId: req.storeId,
              lensId: item.lensId,
              type: 'IN',
              quantity: item.quantity,
              beforeQty: lens.stockQty,
              afterQty: lens.stockQty + item.quantity,
              reason: 'Order Cancel',
              reference: order.orderNumber
            }
          });
        }

        // 🟩 ACCESSORY (FIXED)
        else if (item.accessoryId) {
          const acc = await tx.accessory.findFirst({
            where: { id: item.accessoryId, storeId: req.storeId }
          });
          if (!acc) continue;

          await tx.accessory.updateMany({
            where: { id: item.accessoryId, storeId: req.storeId },
            data: {
              stockQty: { increment: item.quantity }
            }
          });

          await tx.stockMovement.create({
            data: {
              storeId: req.storeId,
              accessoryId: item.accessoryId,
              type: 'IN',
              quantity: item.quantity,
              beforeQty: acc.stockQty,
              afterQty: acc.stockQty + item.quantity,
              reason: 'Order Cancel',
              reference: order.orderNumber
            }
          });
        }
      }

      // 🔥 Cancel order (soft delete)
      const updateResult = await tx.order.updateMany({
        where: { id: req.params.id, storeId: req.storeId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason
        }
      });
      if (!updateResult.count) throw Object.assign(new Error('Order not found'), { status: 404 });

      await tx.orderStatusLog.create({
        data: {
          orderId: req.params.id,
          status: 'CANCELLED',
          note: reason || 'Cancelled by admin'
        }
      });

    });
    res.json({ success: true });

  } catch (e) {
    next(e);
  }
});

module.exports = router;
