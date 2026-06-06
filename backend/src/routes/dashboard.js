const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const sid = req.storeId;
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

    const [todayCount, todayRev, todayReturns, pending, totalCust, monthRev, monthReturns, lastMonthRev, lastMonthReturns, lowStock, recentOrders, statusBreakdown, weekSales, topFrames, payBreakdown] = await Promise.all([
      prisma.order.count({ where: { storeId: sid, createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } } }),
      prisma.order.aggregate({ where: { storeId: sid, createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true } }),
      prisma.salesReturn.aggregate({ where: { storeId: sid, returnedAt: { gte: today, lt: tomorrow } }, _sum: { refundAmount: true } }),
      prisma.order.count({ where: { storeId: sid, status: { in: ['CREATED','LENS_ORDERED','GRINDING','FITTING','READY'] } } }),
      prisma.customer.count({ where: { storeId: sid } }),
      prisma.order.aggregate({ where: { storeId: sid, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true } }),
      prisma.salesReturn.aggregate({ where: { storeId: sid, returnedAt: { gte: monthStart } }, _sum: { refundAmount: true } }),
      prisma.order.aggregate({ where: { storeId: sid, createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true } }),
      prisma.salesReturn.aggregate({ where: { storeId: sid, returnedAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { refundAmount: true } }),
      prisma.$queryRaw`SELECT id, brand, model, "frameCode", "stockQty", "lowStockAlert" FROM frames WHERE "storeId" = ${sid} AND "isActive" = true AND "stockQty" <= "lowStockAlert" ORDER BY "stockQty" ASC LIMIT 8`,
      prisma.order.findMany({ where: { storeId: sid }, orderBy: { createdAt: 'desc' }, take: 6, include: { customer: { select: { name: true, phone: true } } } }),
      prisma.order.groupBy({ by: ['status'], where: { storeId: sid }, _count: true }),
      prisma.$queryRaw`
        SELECT d.date, COALESCE(o.orders,0)::int as orders, (COALESCE(o.revenue,0) - COALESCE(r.returns,0))::float as revenue
        FROM (
          SELECT DATE("createdAt") as date FROM orders WHERE "storeId"=${sid} AND status!='CANCELLED' AND "createdAt">=NOW()-INTERVAL '7 days'
          UNION
          SELECT DATE("returnedAt") as date FROM sales_returns WHERE "storeId"=${sid} AND "returnedAt">=NOW()-INTERVAL '7 days'
        ) d
        LEFT JOIN (
          SELECT DATE("createdAt") as date, COUNT(*)::int as orders, COALESCE(SUM("totalAmount"),0)::float as revenue
          FROM orders WHERE "storeId"=${sid} AND status!='CANCELLED' AND "createdAt">=NOW()-INTERVAL '7 days'
          GROUP BY DATE("createdAt")
        ) o ON o.date = d.date
        LEFT JOIN (
          SELECT DATE("returnedAt") as date, COALESCE(SUM("refundAmount"),0)::float as returns
          FROM sales_returns WHERE "storeId"=${sid} AND "returnedAt">=NOW()-INTERVAL '7 days'
          GROUP BY DATE("returnedAt")
        ) r ON r.date = d.date
        ORDER BY d.date ASC
      `,
      prisma.$queryRaw`SELECT f.brand, f.model, f."frameCode" as "frameCode", SUM(oi.quantity)::int as "unitsSold", SUM(oi."totalPrice")::float as revenue FROM order_items oi JOIN frames f ON oi."frameId"=f.id JOIN orders o ON oi."orderId"=o.id WHERE o."storeId"=${sid} AND o.status!='CANCELLED' AND o."createdAt">=NOW()-INTERVAL '30 days' GROUP BY f.id,f.brand,f.model,f."frameCode" ORDER BY "unitsSold" DESC LIMIT 5`,
      prisma.order.groupBy({ by: ['paymentMethod'], where: { storeId: sid, status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    ]);

    const thisMonth = (monthRev._sum.totalAmount || 0) - (monthReturns._sum.refundAmount || 0);
    const lastMonth = (lastMonthRev._sum.totalAmount || 0) - (lastMonthReturns._sum.refundAmount || 0);
    const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : 0;

    res.json({ success: true, data: {
      stats: { todayOrders: todayCount, todayRevenue: (todayRev._sum.totalAmount||0) - (todayReturns._sum.refundAmount || 0), pendingOrders: pending, totalCustomers: totalCust, monthRevenue: thisMonth, growth: Number(growth) },
      lowStock, recentOrders,
      ordersByStatus: statusBreakdown.reduce((a,s) => ({...a,[s.status]:s._count}),{}),
      weekSales, topFrames,
      paymentBreakdown: payBreakdown.map(p => ({ method: p.paymentMethod, total: p._sum.totalAmount||0, count: p._count }))
    }});
  } catch (e) { next(e); }
});

module.exports = router;
