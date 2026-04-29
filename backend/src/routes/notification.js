// backend/src/routes/notifications.js
const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/notifications
 * Returns today's delivery tasks + low stock alerts + pending orders.
 * Visible to all roles (STAFF, SHOP_ADMIN, SUPER_ADMIN).
 */
router.get('/', async (req, res, next) => {
  try {
    const sid = req.storeId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Orders with status READY (awaiting delivery today)
    const readyOrders = await prisma.order.findMany({
      where: {
        storeId: sid,
        status: 'READY',
      },
      orderBy: { updatedAt: 'asc' },
      take: 20,
      include: {
        customer: { select: { name: true, phone: true } },
      },
    });

    // Orders updated to READY today specifically (fresh deliveries)
    const todayDeliveries = await prisma.order.findMany({
      where: {
        storeId: sid,
        status: 'DELIVERED',
        updatedAt: { gte: today, lt: tomorrow },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        customer: { select: { name: true, phone: true } },
      },
    });

    // Orders still in progress (CREATED, LENS_ORDERED, GRINDING, FITTING)
    const inProgressOrders = await prisma.order.findMany({
      where: {
        storeId: sid,
        status: { in: ['CREATED', 'LENS_ORDERED', 'GRINDING', 'FITTING'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      include: {
        customer: { select: { name: true, phone: true } },
      },
    });

    // Low stock frames
    const lowStockFrames = await prisma.$queryRaw`
      SELECT id, brand, model, "frameCode", "stockQty"
      FROM frames
      WHERE "storeId" = ${sid}
        AND "isActive" = true
        AND "stockQty" <= "lowStockAlert"
      ORDER BY "stockQty" ASC
      LIMIT 5
    `;

    // Build notification list
    const notifications = [];

    // Today's delivery notifications (READY orders)
    readyOrders.forEach(o => {
      notifications.push({
        id: `ready-${o.id}`,
        type: 'DELIVERY',
        priority: 'high',
        title: 'Ready for Delivery',
        message: `${o.customer?.name}'s order ${o.orderNumber} is ready to be delivered.`,
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.name,
        customerPhone: o.customer?.phone,
        createdAt: o.updatedAt,
        read: false,
      });
    });

    // In-progress order reminders
    inProgressOrders.forEach(o => {
      const statusLabels = {
        CREATED: 'just placed',
        LENS_ORDERED: 'lens ordered',
        GRINDING: 'in grinding',
        FITTING: 'in fitting',
      };
      notifications.push({
        id: `progress-${o.id}`,
        type: 'ORDER_UPDATE',
        priority: 'medium',
        title: 'Order In Progress',
        message: `Order ${o.orderNumber} for ${o.customer?.name} is ${statusLabels[o.status] || o.status}.`,
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.name,
        status: o.status,
        createdAt: o.createdAt,
        read: false,
      });
    });

    // Low stock alerts
    lowStockFrames.forEach(f => {
      notifications.push({
        id: `stock-${f.id}`,
        type: 'LOW_STOCK',
        priority: f.stockQty === 0 ? 'high' : 'medium',
        title: f.stockQty === 0 ? 'Out of Stock' : 'Low Stock Alert',
        message: `${f.brand} ${f.model} (${f.frameCode}) has ${f.stockQty === 0 ? 'no' : f.stockQty} units left.`,
        frameId: f.id,
        stockQty: f.stockQty,
        createdAt: new Date(),
        read: false,
      });
    });

    // Today's delivered orders summary
    if (todayDeliveries.length > 0) {
      notifications.push({
        id: `delivered-today-summary`,
        type: 'SUMMARY',
        priority: 'low',
        title: `${todayDeliveries.length} Delivered Today`,
        message: `${todayDeliveries.length} order(s) successfully delivered today. Great work!`,
        createdAt: new Date(),
        read: false,
      });
    }

    // Sort: high priority first, then by date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    notifications.sort((a, b) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      data: {
        notifications,
        counts: {
          total: notifications.length,
          high: notifications.filter(n => n.priority === 'high').length,
          deliveryReady: readyOrders.length,
          lowStock: lowStockFrames.length,
          inProgress: inProgressOrders.length,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;