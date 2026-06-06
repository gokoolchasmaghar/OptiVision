const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireStaff } = require('../middleware/auth');

router.use(authenticate);

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseDate = (value, label, endOfDay = false) => {
  if (!value) return null;
  const text = String(value);
  const date = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999` : text);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`Invalid ${label}`), { status: 400 });
  return date;
};

const returnedQuantityMap = async (orderId, tx = prisma) => {
  const rows = await tx.salesReturnItem.groupBy({
    by: ['orderItemId'],
    where: { salesReturn: { orderId } },
    _sum: { quantity: true },
  });
  return new Map(rows.map(row => [row.orderItemId, row._sum.quantity || 0]));
};

const addStock = async (tx, storeId, orderNumber, item, quantity, reason) => {
  if (item.frameId) {
    const frame = await tx.frame.findFirst({ where: { id: item.frameId, storeId } });
    if (!frame) return;
    await tx.frame.updateMany({ where: { id: item.frameId, storeId }, data: { stockQty: { increment: quantity } } });
    await tx.stockMovement.create({
      data: { storeId, frameId: item.frameId, type: 'RETURN', quantity, beforeQty: frame.stockQty, afterQty: frame.stockQty + quantity, reason, reference: orderNumber },
    });
    return;
  }

  if (item.lensId) {
    const lens = await tx.lens.findFirst({ where: { id: item.lensId, storeId } });
    if (!lens) return;
    await tx.lens.updateMany({ where: { id: item.lensId, storeId }, data: { stockQty: { increment: quantity } } });
    await tx.stockMovement.create({
      data: { storeId, lensId: item.lensId, type: 'RETURN', quantity, beforeQty: lens.stockQty, afterQty: lens.stockQty + quantity, reason, reference: orderNumber },
    });
    return;
  }

  if (item.accessoryId) {
    const accessory = await tx.accessory.findFirst({ where: { id: item.accessoryId, storeId } });
    if (!accessory) return;
    await tx.accessory.updateMany({ where: { id: item.accessoryId, storeId }, data: { stockQty: { increment: quantity } } });
    await tx.stockMovement.create({
      data: { storeId, accessoryId: item.accessoryId, type: 'RETURN', quantity, beforeQty: accessory.stockQty, afterQty: accessory.stockQty + quantity, reason, reference: orderNumber },
    });
  }
};

router.get('/', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const dateFrom = parseDate(req.query.dateFrom, 'dateFrom');
    const dateTo = parseDate(req.query.dateTo, 'dateTo', true);
    const search = String(req.query.search || '').trim();
    const where = {
      storeId: req.storeId,
      ...(dateFrom || dateTo ? { returnedAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
      ...(search ? {
        OR: [
          { reason: { contains: search, mode: 'insensitive' } },
          { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
          { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
          { order: { customer: { phone: { contains: search } } } },
        ],
      } : {}),
    };

    const [returns, total] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { returnedAt: 'desc' },
        include: {
          staff: { select: { id: true, name: true, role: true } },
          order: { select: { id: true, orderNumber: true, totalAmount: true, customer: { select: { id: true, name: true, phone: true } } } },
          items: true,
        },
      }),
      prisma.salesReturn.count({ where }),
    ]);

    res.json({ success: true, data: returns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) {
    next(e);
  }
});

router.get('/order/:orderId/preview', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, storeId: req.storeId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
        returns: { include: { items: true, staff: { select: { id: true, name: true } } }, orderBy: { returnedAt: 'desc' } },
      },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'CANCELLED') return res.status(400).json({ success: false, message: 'Cancelled orders cannot be returned here' });

    const returned = await returnedQuantityMap(order.id);
    const items = order.items.map(item => {
      const returnedQty = returned.get(item.id) || 0;
      const availableQty = Math.max(0, Number(item.quantity || 0) - returnedQty);
      const unitRefund = Number(item.quantity || 0) > 0 ? roundMoney(Number(item.totalPrice || 0) / Number(item.quantity)) : 0;
      return { ...item, returnedQty, availableQty, unitRefund, maxRefundAmount: roundMoney(unitRefund * availableQty) };
    });

    res.json({ success: true, data: { ...order, items } });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireStaff, async (req, res, next) => {
  try {
    const orderId = String(req.body.orderId || '').trim();
    const reason = String(req.body.reason || '').trim();
    const returnedAt = req.body.returnedAt ? parseDate(req.body.returnedAt, 'returnedAt') : new Date();
    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
    if (!reason) return res.status(400).json({ success: false, message: 'Return reason is required' });
    if (!requestedItems.length) return res.status(400).json({ success: false, message: 'At least one returned item is required' });

    const result = await prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({
        where: { id: orderId, storeId: req.storeId },
        include: { items: true },
      });
      if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (order.status === 'CANCELLED') throw Object.assign(new Error('Cancelled orders cannot be returned here'), { status: 400 });

      const returned = await returnedQuantityMap(order.id, tx);
      const orderItemsById = new Map(order.items.map(item => [item.id, item]));
      const seen = new Set();
      const returnItems = [];

      for (const rawItem of requestedItems) {
        const orderItemId = String(rawItem.orderItemId || '').trim();
        const quantity = Number(rawItem.quantity);
        if (!orderItemId || seen.has(orderItemId)) throw Object.assign(new Error('Duplicate or invalid return item'), { status: 400 });
        seen.add(orderItemId);
        if (!Number.isInteger(quantity) || quantity < 1) throw Object.assign(new Error('Return quantities must be positive whole numbers'), { status: 400 });

        const item = orderItemsById.get(orderItemId);
        if (!item) throw Object.assign(new Error('Returned item is not part of this order'), { status: 400 });

        const alreadyReturned = returned.get(item.id) || 0;
        const availableQty = Math.max(0, Number(item.quantity || 0) - alreadyReturned);
        if (quantity > availableQty) throw Object.assign(new Error(`${item.name} has only ${availableQty} returnable unit(s)`), { status: 400 });

        const unitRefund = Number(item.quantity || 0) > 0 ? roundMoney(Number(item.totalPrice || 0) / Number(item.quantity)) : 0;
        returnItems.push({
          item,
          quantity,
          unitRefund,
          refundAmount: roundMoney(unitRefund * quantity),
        });
      }

      const refundAmount = roundMoney(returnItems.reduce((sum, item) => sum + item.refundAmount, 0));
      if (refundAmount <= 0) throw Object.assign(new Error('Refund amount must be greater than zero'), { status: 400 });

      const salesReturn = await tx.salesReturn.create({
        data: {
          storeId: req.storeId,
          orderId: order.id,
          staffId: req.user.id,
          refundAmount,
          reason,
          returnedAt,
          items: {
            create: returnItems.map(({ item, quantity, unitRefund, refundAmount: itemRefund }) => ({
              orderItemId: item.id,
              itemType: item.itemType,
              itemName: item.name,
              quantity,
              unitRefund,
              refundAmount: itemRefund,
            })),
          },
        },
        include: { items: true, staff: { select: { id: true, name: true, role: true } } },
      });

      for (const { item, quantity } of returnItems) {
        await addStock(tx, req.storeId, order.orderNumber, item, quantity, `Sales Return: ${reason}`);
      }

      const updatedReturned = await returnedQuantityMap(order.id, tx);

      const totalSoldQty = order.items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      const totalReturnedQty = [...updatedReturned.values()].reduce(
        (sum, qty) => sum + Number(qty || 0),
        0
      );

      const nextStatus =
        totalReturnedQty >= totalSoldQty
          ? 'RETURNED'
          : 'PARTIALLY_RETURNED';

      const existingRefund = Number(order.refundAmount || 0);
      const paidAmount = Math.max(0, Number(order.advanceAmount || 0));
      const nextRefundAmount = roundMoney(existingRefund + refundAmount);
      const nextAdvanceAmount = Math.max(0, roundMoney(paidAmount - refundAmount));
      const nextBalanceAmount = Math.max(0, roundMoney(Number(order.totalAmount || 0) - nextAdvanceAmount - nextRefundAmount));

      await tx.order.updateMany({
        where: { id: order.id, storeId: req.storeId },
        data: {
          refundAmount: nextRefundAmount,
          refundedAt: returnedAt,
          refundedById: req.user.id,
          refundNote: reason,
          status: nextStatus,
          advanceAmount: nextAdvanceAmount,
          balanceAmount: nextBalanceAmount,
          paymentStatus: nextAdvanceAmount <= 0 ? 'PENDING' : nextBalanceAmount > 0 ? 'PARTIAL' : 'PAID',
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: order.id,
          status: nextStatus,
          note: `Sales return ${salesReturn.id.slice(0, 8)}: ${refundAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} - ${reason}`,
        },
      });

      return salesReturn;
    });

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
