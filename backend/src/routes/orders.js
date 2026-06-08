const router = require('express').Router();
const prisma = require('../utils/prisma');
const { generateInvoice } = require('../controllers/invoiceController');
const { generatePublicInvoice } = require('../controllers/invoiceController');
const { authenticate, requireAdmin, requireStaff } = require('../middleware/auth');
const { PAYMENT_METHODS, ORDER_STATUSES, enumValue, positiveInt, numberOrDefault } = require('../utils/normalize');
const { calculateOrderLineGST, getProductGSTDefault, summarizeGST } = require('../utils/gst');

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
const isGstEnabled = store => store?.gstEnabled !== false;

const inventoryKeyForItem = item => {
  if (item.frameId) return `frame:${item.frameId}`;
  if (item.lensId) return `lens:${item.lensId}`;
  if (item.accessoryId) return `accessory:${item.accessoryId}`;
  return null;
};

const itemIdentityData = item => ({
  itemType: item.itemType,
  frameId: item.frameId || null,
  lensId: item.lensId || null,
  accessoryId: item.accessoryId || null,
  name: item.name,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  discountAmount: item.discountAmount,
  discountPct: item.discountPct,
  totalPrice: item.totalPrice,
});

const itemPayableAmount = item => roundMoney(Number(item.payableAmount ?? (Number(item.taxableValue || 0) + Number(item.gstAmount || 0))));

const productModelForType = itemType => {
  if (itemType === 'frame') return 'frame';
  if (itemType === 'lens') return 'lens';
  if (itemType === 'accessory') return 'accessory';
  return null;
};

const attachProductTaxSnapshot = async (db, storeId, item, existingItem = null, pricesInclusiveOfGst = false) => {
  if (existingItem) {
    return {
      ...item,
      hsn: existingItem.hsn,
      gstRate: existingItem.gstRate,
      rateInclusiveOfGst: pricesInclusiveOfGst,
    };
  }

  const modelName = productModelForType(item.itemType);
  const itemId = item.frameId || item.lensId || item.accessoryId;
  const product = modelName && itemId
    ? await db[modelName].findFirst({
      where: { id: itemId, storeId },
      select: { hsn: true, gstRate: true },
    })
    : null;
  const defaults = getProductGSTDefault(item.itemType);

  return {
    ...item,
    hsn: product?.hsn || item.hsn || defaults.hsn,
    gstRate: product?.gstRate ?? item.gstRate ?? defaults.gstRate,
    rateInclusiveOfGst: pricesInclusiveOfGst,
  };
};

const normalizeOrderItem = (item, gstEnabled = true) => {
  const gst = calculateOrderLineGST({
    itemType: item.itemType,
    quantity: positiveInt(item.quantity),
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
    discountPct: item.discountPct,
    hsn: item.hsn,
    gstRate: item.gstRate,
    rateInclusiveOfGst: item.rateInclusiveOfGst,
    gstEnabled,
  });
  return {
    ...item,
    ...gst,
  };
};

const restoreOrderItemStock = async (tx, storeId, order, item, reason = 'Order Cancel') => {
  if (item.frameId) {
    const frame = await tx.frame.findFirst({ where: { id: item.frameId, storeId } });
    if (!frame) return;

    await tx.frame.updateMany({
      where: { id: item.frameId, storeId },
      data: { stockQty: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        storeId,
        frameId: item.frameId,
        type: 'IN',
        quantity: item.quantity,
        beforeQty: frame.stockQty,
        afterQty: frame.stockQty + item.quantity,
        reason,
        reference: order.orderNumber,
      },
    });
    return;
  }

  if (item.lensId) {
    const lens = await tx.lens.findFirst({ where: { id: item.lensId, storeId } });
    if (!lens) return;

    await tx.lens.updateMany({
      where: { id: item.lensId, storeId },
      data: { stockQty: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        storeId,
        lensId: item.lensId,
        type: 'IN',
        quantity: item.quantity,
        beforeQty: lens.stockQty,
        afterQty: lens.stockQty + item.quantity,
        reason,
        reference: order.orderNumber,
      },
    });
    return;
  }

  if (item.accessoryId) {
    const accessory = await tx.accessory.findFirst({ where: { id: item.accessoryId, storeId } });
    if (!accessory) return;

    await tx.accessory.updateMany({
      where: { id: item.accessoryId, storeId },
      data: { stockQty: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        storeId,
        accessoryId: item.accessoryId,
        type: 'IN',
        quantity: item.quantity,
        beforeQty: accessory.stockQty,
        afterQty: accessory.stockQty + item.quantity,
        reason,
        reference: order.orderNumber,
      },
    });
  }
};

router.get('/public/:id/invoice', generatePublicInvoice);

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
      prisma.order.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { customer: { select: { id: true, name: true, phone: true } }, staff: { select: { id: true, name: true } }, refundedBy: { select: { id: true, name: true, role: true } }, items: true, payments: true } }),
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
        refundedBy: { select: { id: true, name: true, role: true } },
        items: { include: { frame: { select: { id: true, brand: true, model: true, imageUrl: true } }, lens: { select: { id: true, name: true } } } },
        payments: { orderBy: { paidAt: 'asc' } },
        statusLogs: { orderBy: { changedAt: 'asc' } },
        returns: { include: { items: true, staff: { select: { id: true, name: true, role: true } } }, orderBy: { returnedAt: 'desc' } },
        editLogs: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'desc' } }
      }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});

router.get('/:id/invoice', generateInvoice);

const getFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // Jan = 0

  return month >= 2 ? year : year - 1;
};

router.post('/', requireStaff, async (req, res, next) => {
  try {
    const { customerId, prescriptionId, items, discountAmount = 0, advanceAmount = 0, paymentMethod = 'CASH', deliveryDate, frameDetails, lensDetails, notes, redeemPoints = 0 } = req.body;
    if (!customerId || !items?.length) return res.status(400).json({ success: false, message: 'customerId and items are required' });
    const finalPaymentMethod = enumValue(paymentMethod, PAYMENT_METHODS);
    if (!finalPaymentMethod) return res.status(400).json({ success: false, message: 'Invalid payment method' });

    if (items.some(item => !positiveInt(item.quantity) || !['frame', 'lens', 'accessory'].includes(item.itemType))) {
      return res.status(400).json({ success: false, message: 'Invalid order items' });
    }

    const store = await prisma.store.findUnique({
      where: { id: req.storeId },
      select: { id: true, gstEnabled: true, pricesInclusiveOfGst: true, taxRate: true, invoicePrefix: true }
    });
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, storeId: req.storeId },
      select: { id: true, loyaltyPoints: true },
    });
    if (!customer) return res.status(400).json({ success: false, message: 'Invalid customer for this store' });

    if (prescriptionId) {
      const prescription = await prisma.prescription.findFirst({
        where: { id: prescriptionId, customerId, customer: { storeId: req.storeId } },
        select: { id: true },
      });
      if (!prescription) return res.status(400).json({ success: false, message: 'Invalid prescription for this customer' });
    }

    const itemsWithTaxSnapshot = await Promise.all(
      items.map(item => attachProductTaxSnapshot(prisma, req.storeId, item, null, store.pricesInclusiveOfGst === true))
    );
    const calculatedItems = itemsWithTaxSnapshot.map(item => normalizeOrderItem(item, isGstEnabled(store)));

    const calculatedSubtotal = roundMoney(
      calculatedItems.reduce((sum, item) => sum + item.totalPrice, 0)
    );

    // Bill-level discount (shown separately, applied after tax calculation)
    const safeDiscount = Math.min(
      Math.max(roundMoney(discountAmount), 0),
      calculatedSubtotal
    );

    const calculatedItemsPayable = roundMoney(
      calculatedItems.reduce((sum, item) => sum + itemPayableAmount(item), 0)
    );

    const taxSummary = summarizeGST(calculatedItems);
    const calculatedTax = taxSummary.gstAmount;

    // Calculate effective tax rate based on subtotal and tax (bill discount is separate)
    const effectiveTaxRate = calculatedSubtotal > 0 ? roundMoney((calculatedTax / calculatedSubtotal) * 100) : 0;

    // ✅ SAFE LOYALTY POINTS
    const safeRedeemPoints = Math.min(
      Math.max(Number(redeemPoints) || 0, 0),
      customer.loyaltyPoints || 0,
      Math.max(0, calculatedItemsPayable - safeDiscount)
    );

    // ✅ FINAL TOTAL (subtotal - bill discount + tax - loyalty points)
    const calculatedTotal = roundMoney(
      calculatedItemsPayable - safeDiscount - safeRedeemPoints
    );
    const safeAdvanceAmount = Math.min(Math.max(numberOrDefault(advanceAmount, 0), 0), calculatedTotal);

    const fy = getFinancialYear();
    const shortYear = String(fy).slice(-2);

    const order = await prisma.$transaction(async tx => {
      const updatedStore = await tx.store.update({
        where: { id: req.storeId },
        data: {
          invoiceCounter: { increment: 1 },
          invoiceYear: fy
        }
      });

      const counter = updatedStore.invoiceCounter;
      const orderNumber = `${store.invoicePrefix}-${shortYear}${String(counter).padStart(3, '0')}`;

      for (const item of calculatedItems) {
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
          else {
            throw Object.assign(new Error(`Insufficient stock: ${lens?.name || 'lens'}`), { status: 400 });
          }
        }
        if (item.itemType === 'accessory' && item.accessoryId) {
          const accessory = await tx.accessory.findFirst({
            where: { id: item.accessoryId, storeId: req.storeId, isActive: true }
          });
          if (!accessory || accessory.stockQty < item.quantity) {
            throw Object.assign(new Error(`Insufficient stock: ${item.name || 'accessory'}`), { status: 400 });
          }
          const bef = accessory.stockQty;
          await tx.accessory.updateMany({
            where: { id: item.accessoryId, storeId: req.storeId },
            data: { stockQty: { decrement: item.quantity } }
          });
          await tx.stockMovement.create({
            data: {
              storeId: req.storeId,
              accessoryId: item.accessoryId,
              type: 'OUT',
              quantity: item.quantity,
              beforeQty: bef,
              afterQty: bef - item.quantity,
              reason: 'Order',
              reference: orderNumber
            }
          });
        }
      }

      const newOrder = await tx.order.create({
        data: {
          storeId: req.storeId, orderNumber, customerId, prescriptionId: prescriptionId || null, staffId: req.user.id,
          subtotal: calculatedSubtotal, discountAmount: safeDiscount, discountPct: calculatedSubtotal > 0 ? roundMoney((safeDiscount / calculatedSubtotal) * 100) : 0, redeemPoints: safeRedeemPoints, taxAmount: calculatedTax, taxPct: effectiveTaxRate, totalAmount: calculatedTotal,
          advanceAmount: safeAdvanceAmount, balanceAmount: Math.max(0, calculatedTotal - safeAdvanceAmount),
          paymentMethod: finalPaymentMethod, paymentStatus: safeAdvanceAmount >= calculatedTotal ? 'PAID' : safeAdvanceAmount > 0 ? 'PARTIAL' : 'PENDING',
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null, frameDetails, lensDetails, notes,
          items: {
            create: calculatedItems.map(i => ({
              itemType: i.itemType,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountAmount: i.discountAmount,
              discountPct: i.discountPct,
              totalPrice: i.totalPrice,
              hsn: i.hsn,
              gstRate: i.gstRate,
              taxableValue: i.taxableValue,
              gstAmount: i.gstAmount,
              rateInclusiveOfGst: i.rateInclusiveOfGst,

              ...(i.frameId && {
                frame: {
                  connect: { id: i.frameId }
                }
              }),

              ...(i.lensId && {
                lens: {
                  connect: { id: i.lensId }
                }
              }),

              ...(i.accessoryId && {
                accessory: {
                  connect: { id: i.accessoryId }
                }
              }),
            }))
          }, statusLogs: { create: { status: 'CREATED', note: 'Order created' } },
          ...(safeAdvanceAmount > 0 ? { payments: { create: [{ amount: safeAdvanceAmount, method: finalPaymentMethod, note: 'Advance' }] } } : {})
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
            increment: earnedPoints - safeRedeemPoints
          }
        }
      });
      if (!customerUpdate.count) throw Object.assign(new Error('Customer not found'), { status: 404 });
      // 🔥 LOYALTY LOGIC END

      return newOrder;
    });

    res.status(201).json({ success: true, data: order });
  } catch (e) { next(e); }
});

router.patch('/:id/status', requireStaff, async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const nextStatus = enumValue(status, ORDER_STATUSES);
    if (!nextStatus) return res.status(400).json({ success: false, message: 'Invalid order status' });
    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        redeemPoints: true,
        totalAmount: true,
        status: true,
        items: true,
      },
    });

    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

    const isAccessoryOnly =
      existing.items?.length > 0 &&
      existing.items.every(
        item =>
          item.accessoryId &&
          !item.frameId &&
          !item.lensId
      );

    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }
    // 🔒 STAFF restrictions
    if (req.user.role === 'STAFF') {
      if (nextStatus === 'CANCELLED') {
        return res.status(403).json({
          success: false,
          message: 'Staff cannot cancel orders'
        });
      }

      const allowedTransitions = isAccessoryOnly
        ? {
          CREATED: ['READY'],
          READY: ['DELIVERED']
        }
        : {
          CREATED: ['LENS_ORDERED'],
          LENS_ORDERED: ['GRINDING'],
          GRINDING: ['FITTING'],
          FITTING: ['READY'],
          READY: ['DELIVERED']
        };

      const current = existing.status;

      if (!allowedTransitions[current]?.includes(nextStatus)) {
        return res.status(403).json({
          success: false,
          message: `Invalid status transition from ${current} to ${nextStatus}`
        });
      }
    }
    const order = await prisma.$transaction(async tx => {
      const result = await tx.order.updateMany({
        where: { id: req.params.id, storeId: req.storeId },
        data: { status: nextStatus, ...(nextStatus === 'DELIVERED' && { deliveredAt: new Date() }), ...(nextStatus === 'CANCELLED' && { cancelledAt: new Date(), cancelReason: note }) }
      });
      if (!result.count) throw Object.assign(new Error('Order not found'), { status: 404 });
      // ✅ Refund loyalty points
      if (nextStatus === 'CANCELLED') {
        for (const item of existing.items) {
          await restoreOrderItemStock(tx, req.storeId, existing, item);
        }

        const earnedPoints = Math.floor(Number(existing.totalAmount || 0) / 100);
        await tx.customer.updateMany({
          where: { id: existing.customerId, storeId: req.storeId },
          data: {
            loyaltyPoints: {
              increment: Number(existing.redeemPoints || 0) - earnedPoints
            }
          }
        });
      }
      await tx.orderStatusLog.create({ data: { orderId: req.params.id, status: nextStatus, note } });
      return tx.order.findFirst({ where: { id: req.params.id, storeId: req.storeId } });
    });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const {
      customerId,
      customer,
      prescriptionId,
      items,
      discountAmount = 0,
      redeemPoints = 0,
      advanceAmount = 0,
      paymentMethod = 'CASH',
      deliveryDate,
      frameDetails,
      lensDetails,
      notes,
      reason,
    } = req.body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'customerId and items are required' });
    }

    const finalPaymentMethod = enumValue(paymentMethod, PAYMENT_METHODS);
    if (!finalPaymentMethod) return res.status(400).json({ success: false, message: 'Invalid payment method' });

    if (items.some(item => !positiveInt(item.quantity) || !['frame', 'lens', 'accessory'].includes(item.itemType))) {
      return res.status(400).json({ success: false, message: 'Invalid order items' });
    }

    const editedOrder = await prisma.$transaction(async tx => {
      const existing = await tx.order.findFirst({
        where: { id: req.params.id, storeId: req.storeId },
        include: { items: true, payments: true, returns: { select: { id: true } }, customer: true },
      });
      if (!existing) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (existing.status === 'CANCELLED') throw Object.assign(new Error('Cancelled orders cannot be edited'), { status: 400 });
      if (existing.returns.length > 0) throw Object.assign(new Error('Orders with sales returns cannot be edited'), { status: 400 });

      const store = await tx.store.findUnique({
        where: { id: req.storeId },
        select: { id: true, gstEnabled: true, pricesInclusiveOfGst: true, taxRate: true }
      });
      if (!store) throw Object.assign(new Error('Store not found'), { status: 404 });

      const nextCustomer = await tx.customer.findFirst({
        where: { id: customerId, storeId: req.storeId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!nextCustomer) throw Object.assign(new Error('Invalid customer for this store'), { status: 400 });

      if (customer && customerId === existing.customerId) {
        const customerPatch = {};
        ['name', 'phone', 'email', 'address'].forEach(field => {
          if (customer[field] !== undefined) customerPatch[field] = customer[field] ? String(customer[field]).trim() : null;
        });
        if (Object.keys(customerPatch).length > 0) {
          await tx.customer.updateMany({ where: { id: customerId, storeId: req.storeId }, data: customerPatch });
        }
      }

      if (prescriptionId) {
        const prescription = await tx.prescription.findFirst({
          where: { id: prescriptionId, customerId, customer: { storeId: req.storeId } },
          select: { id: true },
        });
        if (!prescription) throw Object.assign(new Error('Invalid prescription for this customer'), { status: 400 });
      }

      // 🔒 FREEZE GST ON ORDER ITEMS: Preserve original GST values unless item inventory reference changes
      // Create mapping of existing items by inventory key for lookup
      const existingItemsByKey = new Map();
      for (const item of existing.items) {
        const key = inventoryKeyForItem(item);
        if (key) existingItemsByKey.set(key, item);
      }

      // For each normalized item, check if it's the same inventory item
      // If yes, preserve GST values; if no, calculate new GST values
      const itemsForGstCalc = items.map(item => {
        const key = inventoryKeyForItem(item);
        const existingItem = key ? existingItemsByKey.get(key) : null;

        if (existingItem) {
          // 🔒 FROZEN: Same inventory item, preserve original GST values
          return {
            ...item,
            hsn: existingItem.hsn, // Preserved
            gstRate: existingItem.gstRate, // Preserved
            rateInclusiveOfGst: store.pricesInclusiveOfGst === true,
          };
        } else {
          // NEW ITEM: Calculate fresh GST values
          // For new items, we don't have the original product master data, so use defaults
          return attachProductTaxSnapshot(tx, req.storeId, item, null, store.pricesInclusiveOfGst === true);
        }
      });

      const calculatedItems = (await Promise.all(itemsForGstCalc)).map(item => normalizeOrderItem(item, isGstEnabled(store)));

      const calculatedSubtotal = roundMoney(calculatedItems.reduce((sum, item) => sum + item.totalPrice, 0));
      const safeDiscount = Math.min(Math.max(roundMoney(discountAmount), 0), calculatedSubtotal);
      const calculatedItemsPayable = roundMoney(
        calculatedItems.reduce((sum, item) => sum + itemPayableAmount(item), 0)
      );
      // Calculate tax as sum of per-item GST amounts (already calculated on item-discounted values)
      const calculatedTax = roundMoney(calculatedItems.reduce((sum, item) => sum + item.gstAmount, 0));
      // Calculate effective tax rate based on subtotal and tax (bill discount is separate)
      const effectiveTaxRate = calculatedSubtotal > 0 ? roundMoney((calculatedTax / calculatedSubtotal) * 100) : 0;
      const availablePoints = nextCustomer.id === existing.customerId
        ? Number(nextCustomer.loyaltyPoints || 0) + Number(existing.redeemPoints || 0)
        : Number(nextCustomer.loyaltyPoints || 0);
      const safeRedeemPoints = Math.min(Math.max(Number(redeemPoints) || 0, 0), availablePoints, Math.max(0, calculatedItemsPayable - safeDiscount));
      const calculatedTotal = roundMoney(calculatedItemsPayable - safeDiscount - safeRedeemPoints);
      const safeAdvanceAmount = Math.min(Math.max(numberOrDefault(advanceAmount, 0), 0), calculatedTotal);

      const oldByKey = new Map();
      for (const item of existing.items) {
        const key = inventoryKeyForItem(item);
        if (key) oldByKey.set(key, (oldByKey.get(key) || 0) + Number(item.quantity || 0));
      }

      const newByKey = new Map();
      const newItemByKey = new Map();
      for (const item of calculatedItems) {
        const key = inventoryKeyForItem(item);
        if (!key) throw Object.assign(new Error(`Missing inventory reference for ${item.name || item.itemType}`), { status: 400 });
        newByKey.set(key, (newByKey.get(key) || 0) + Number(item.quantity || 0));
        newItemByKey.set(key, item);
      }

      const keys = new Set([...oldByKey.keys(), ...newByKey.keys()]);
      for (const key of keys) {
        const [type, id] = key.split(':');
        const oldQty = oldByKey.get(key) || 0;
        const newQty = newByKey.get(key) || 0;
        const delta = newQty - oldQty;
        if (delta === 0) continue;

        const model = type === 'frame' ? tx.frame : type === 'lens' ? tx.lens : tx.accessory;
        const current = await model.findFirst({ where: { id, storeId: req.storeId } });
        if (!current) throw Object.assign(new Error('Inventory item not found during edit'), { status: 404 });

        if (delta > 0 && current.stockQty < delta) {
          throw Object.assign(new Error(`Insufficient stock for ${newItemByKey.get(key)?.name || type}`), { status: 400 });
        }

        const afterQty = current.stockQty - delta;
        const updateData = { stockQty: afterQty };
        if (type === 'frame') await tx.frame.updateMany({ where: { id, storeId: req.storeId }, data: updateData });
        if (type === 'lens') await tx.lens.updateMany({ where: { id, storeId: req.storeId }, data: updateData });
        if (type === 'accessory') await tx.accessory.updateMany({ where: { id, storeId: req.storeId }, data: updateData });

        await tx.stockMovement.create({
          data: {
            storeId: req.storeId,
            ...(type === 'frame' && { frameId: id }),
            ...(type === 'lens' && { lensId: id }),
            ...(type === 'accessory' && { accessoryId: id }),
            type: delta > 0 ? 'OUT' : 'IN',
            quantity: Math.abs(delta),
            beforeQty: current.stockQty,
            afterQty,
            reason: 'Bill Edit',
            reference: existing.orderNumber,
          },
        });
      }

      const beforeSnapshot = {
        customerId: existing.customerId,
        prescriptionId: existing.prescriptionId,
        subtotal: existing.subtotal,
        discountAmount: existing.discountAmount,
        redeemPoints: existing.redeemPoints,
        taxAmount: existing.taxAmount,
        taxPct: existing.taxPct,
        totalAmount: existing.totalAmount,
        advanceAmount: existing.advanceAmount,
        balanceAmount: existing.balanceAmount,
        paymentStatus: existing.paymentStatus,
        paymentMethod: existing.paymentMethod,
        deliveryDate: existing.deliveryDate,
        frameDetails: existing.frameDetails,
        lensDetails: existing.lensDetails,
        notes: existing.notes,
        items: existing.items.map(itemIdentityData),
        payments: existing.payments.map(p => ({ amount: p.amount, method: p.method, reference: p.reference, note: p.note, paidAt: p.paidAt })),
      };

      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      await tx.payment.deleteMany({ where: { orderId: existing.id } });

      await tx.order.update({
        where: { id: existing.id },
        data: {
          customerId,
          prescriptionId: prescriptionId || null,
          subtotal: calculatedSubtotal,
          discountAmount: safeDiscount,
          discountPct: calculatedSubtotal > 0 ? roundMoney((safeDiscount / calculatedSubtotal) * 100) : 0,
          redeemPoints: safeRedeemPoints,
          taxAmount: calculatedTax,
          taxPct: effectiveTaxRate,
          totalAmount: calculatedTotal,
          advanceAmount: safeAdvanceAmount,
          balanceAmount: Math.max(0, calculatedTotal - safeAdvanceAmount),
          paymentMethod: finalPaymentMethod,
          paymentStatus: safeAdvanceAmount >= calculatedTotal ? 'PAID' : safeAdvanceAmount > 0 ? 'PARTIAL' : 'PENDING',
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          frameDetails: frameDetails || null,
          lensDetails: lensDetails || null,
          notes: notes || null,
          items: {
            create: calculatedItems.map(i => ({
              itemType: i.itemType,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discountAmount: i.discountAmount,
              discountPct: i.discountPct,
              totalPrice: i.totalPrice,
              hsn: i.hsn,
              gstRate: i.gstRate,
              taxableValue: i.taxableValue,
              gstAmount: i.gstAmount,
              rateInclusiveOfGst: i.rateInclusiveOfGst,
              ...(i.frameId && { frame: { connect: { id: i.frameId } } }),
              ...(i.lensId && { lens: { connect: { id: i.lensId } } }),
              ...(i.accessoryId && { accessory: { connect: { id: i.accessoryId } } }),
            })),
          },
          ...(safeAdvanceAmount > 0 ? {
            payments: { create: [{ amount: safeAdvanceAmount, method: finalPaymentMethod, note: 'Bill edit payment snapshot' }] }
          } : {}),
        },
      });

      const earnedBefore = Math.floor(Number(existing.totalAmount || 0) / 100);
      const earnedAfter = Math.floor(Number(calculatedTotal || 0) / 100);
      if (existing.customerId === customerId) {
        await tx.customer.updateMany({
          where: { id: customerId, storeId: req.storeId },
          data: { loyaltyPoints: { increment: (earnedAfter - safeRedeemPoints) - (earnedBefore - Number(existing.redeemPoints || 0)) } },
        });
      } else {
        await tx.customer.updateMany({
          where: { id: existing.customerId, storeId: req.storeId },
          data: { loyaltyPoints: { increment: Number(existing.redeemPoints || 0) - earnedBefore } },
        });
        await tx.customer.updateMany({
          where: { id: customerId, storeId: req.storeId },
          data: { loyaltyPoints: { increment: earnedAfter - safeRedeemPoints } },
        });
      }

      const fresh = await tx.order.findUnique({
        where: { id: existing.id },
        include: { items: true, payments: true },
      });

      const afterSnapshot = {
        customerId,
        prescriptionId: prescriptionId || null,
        subtotal: fresh.subtotal,
        discountAmount: fresh.discountAmount,
        redeemPoints: fresh.redeemPoints,
        taxAmount: fresh.taxAmount,
        taxPct: fresh.taxPct,
        totalAmount: fresh.totalAmount,
        advanceAmount: fresh.advanceAmount,
        balanceAmount: fresh.balanceAmount,
        paymentStatus: fresh.paymentStatus,
        paymentMethod: fresh.paymentMethod,
        deliveryDate: fresh.deliveryDate,
        frameDetails: fresh.frameDetails,
        lensDetails: fresh.lensDetails,
        notes: fresh.notes,
        items: fresh.items.map(itemIdentityData),
        payments: fresh.payments.map(p => ({ amount: p.amount, method: p.method, reference: p.reference, note: p.note, paidAt: p.paidAt })),
      };

      await tx.orderEditLog.create({
        data: {
          orderId: existing.id,
          userId: req.user.id,
          changes: { reason: reason || null, before: beforeSnapshot, after: afterSnapshot },
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: existing.id,
          status: existing.status,
          note: `Bill edited by ${req.user.name || req.user.email}${reason ? ` - ${reason}` : ''}`,
        },
      });

      return tx.order.findFirst({
        where: { id: existing.id, storeId: req.storeId },
        include: {
          customer: true,
          staff: { select: { id: true, name: true, role: true } },
          items: true,
          payments: { orderBy: { paidAt: 'asc' } },
          statusLogs: { orderBy: { changedAt: 'asc' } },
          editLogs: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'desc' } },
        },
      });
    });

    res.json({ success: true, data: editedOrder });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/payment', requireAdmin, async (req, res, next) => {
  try {
    const { amount, method, reference, note } = req.body;
    const finalMethod = enumValue(method, PAYMENT_METHODS);
    if (!finalMethod) return res.status(400).json({ success: false, message: 'Invalid payment method' });
    if (Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });

    const order = await prisma.order.findFirst({ where: { id: req.params.id, storeId: req.storeId } });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot collect payment for a cancelled order' });
    }
    await prisma.$transaction(async tx => {
      await tx.payment.create({ data: { orderId: req.params.id, amount: Number(amount), method: finalMethod, reference, note } });
      const agg = await tx.payment.aggregate({ where: { orderId: req.params.id }, _sum: { amount: true } });
      const freshOrder = await tx.order.findUnique({ where: { id: req.params.id } });
      const paid = agg._sum.amount || 0;
      const result = await tx.order.updateMany({
        where: { id: req.params.id, storeId: req.storeId },
        data: { advanceAmount: paid, balanceAmount: Math.max(0, freshOrder.totalAmount - paid), paymentStatus: paid >= order.totalAmount ? 'PAID' : 'PARTIAL' }
      });
      if (!result.count) throw Object.assign(new Error('Order not found'), { status: 404 });
    });
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});

router.post('/:id/refund', requireAdmin, async (req, res, next) => {
  try {
    const { note } = req.body;
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        balanceAmount: true,
        refundAmount: true,
        refundedAt: true,
      }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    if (order.status !== 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Refund is allowed only after order cancellation' });
    }
    if (order.refundedAt || Number(order.refundAmount || 0) > 0) {
      return res.status(400).json({ success: false, message: 'Order has already been refunded' });
    }

    const paymentAgg = await prisma.payment.aggregate({
      where: { orderId: req.params.id, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    const paidAmount = roundMoney(paymentAgg._sum.amount || (Number(order.totalAmount || 0) - Number(order.balanceAmount || 0)));
    if (paidAmount <= 0) {
      return res.status(400).json({ success: false, message: 'No collected payment available to refund' });
    }

    const refundedAt = new Date();
    const refunded = await prisma.$transaction(async tx => {
      const result = await tx.order.updateMany({
        where: { id: req.params.id, storeId: req.storeId, refundedAt: null },
        data: {
          refundAmount: paidAmount,
          refundedAt,
          refundedById: req.user.id,
          refundNote: note || null,
        }
      });
      if (!result.count) {
        throw Object.assign(new Error('Order has already been refunded'), { status: 400 });
      }

      await tx.orderStatusLog.create({
        data: {
          orderId: req.params.id,
          status: 'CANCELLED',
          note: `Refunded ${paidAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}${note ? ` - ${note}` : ''}`,
        }
      });

      return tx.order.findFirst({
        where: { id: req.params.id, storeId: req.storeId },
        include: {
          customer: true,
          staff: { select: { id: true, name: true, role: true } },
          refundedBy: { select: { id: true, name: true, role: true } },
          items: true,
          payments: { orderBy: { paidAt: 'asc' } },
          statusLogs: { orderBy: { changedAt: 'asc' } },
        }
      });
    });

    res.json({ success: true, data: refunded });
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
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }

    // ❌ Restrict delete after READY
    if (['READY', 'DELIVERED', 'PARTIALLY_RETURNED', 'RETURNED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order after ${order.status} stage`
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

      const earnedPoints = Math.floor(Number(order.totalAmount || 0) / 100);
      await tx.customer.updateMany({
        where: { id: order.customerId, storeId: req.storeId },
        data: {
          loyaltyPoints: {
            increment: Number(order.redeemPoints || 0) - earnedPoints
          }
        }
      });

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
