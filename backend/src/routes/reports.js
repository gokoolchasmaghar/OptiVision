const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate()-30));
    const dateTo = to ? new Date(to+'T23:59:59') : new Date();
    const [sales, summary] = await Promise.all([
      prisma.$queryRaw`SELECT DATE("createdAt") as date, COUNT(*)::int as orders, COALESCE(SUM("totalAmount"),0)::float as revenue, COALESCE(SUM("discountAmount"),0)::float as discounts, COALESCE(SUM("taxAmount"),0)::float as tax FROM orders WHERE "storeId"=${req.storeId} AND status!='CANCELLED' AND "createdAt" BETWEEN ${dateFrom} AND ${dateTo} GROUP BY DATE("createdAt") ORDER BY date ASC`,
      prisma.order.aggregate({ where: { storeId: req.storeId, status: { not: 'CANCELLED' }, createdAt: { gte: dateFrom, lte: dateTo } }, _sum: { totalAmount: true, discountAmount: true, taxAmount: true }, _count: true, _avg: { totalAmount: true } })
    ]);
    res.json({ success: true, data: { sales, summary } });
  } catch (e) { next(e); }
});

router.get('/frames', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate()-30));
    const dateTo = to ? new Date(to+'T23:59:59') : new Date();
    const data = await prisma.$queryRaw`SELECT f.brand, f.model, f."frameCode" as "frameCode", f."sellingPrice" as price, SUM(oi.quantity)::int as "unitsSold", SUM(oi."totalPrice")::float as revenue, SUM(oi."totalPrice" - oi.quantity*f."purchasePrice")::float as profit FROM order_items oi JOIN frames f ON oi."frameId"=f.id JOIN orders o ON oi."orderId"=o.id WHERE o."storeId"=${req.storeId} AND o.status!='CANCELLED' AND o."createdAt" BETWEEN ${dateFrom} AND ${dateTo} GROUP BY f.id,f.brand,f.model,f."frameCode",f."sellingPrice",f."purchasePrice" ORDER BY "unitsSold" DESC`;
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get('/customers', async (req, res, next) => {
  try {
    const data = await prisma.$queryRaw`SELECT c.id, c.name, c.phone, c.email, COUNT(o.id)::int as "totalOrders", COALESCE(SUM(o."totalAmount"),0)::float as "totalSpent", MAX(o."createdAt") as "lastOrder" FROM customers c LEFT JOIN orders o ON c.id=o."customerId" AND o.status!='CANCELLED' WHERE c."storeId"=${req.storeId} GROUP BY c.id,c.name,c.phone,c.email ORDER BY "totalSpent" DESC NULLS LAST LIMIT 20`;
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

router.get('/profit', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate()-30));
    const dateTo = to ? new Date(to+'T23:59:59') : new Date();
    const data = await prisma.$queryRaw`SELECT COALESCE(SUM(o."totalAmount"),0)::float as "totalRevenue", COALESCE(SUM(o."taxAmount"),0)::float as "totalTax", COALESCE(SUM(o."discountAmount"),0)::float as "totalDiscounts", COALESCE(SUM(CASE WHEN oi."frameId" IS NOT NULL THEN oi.quantity*(oi."unitPrice"-f."purchasePrice") WHEN oi."lensId" IS NOT NULL THEN oi.quantity*(oi."unitPrice"-l."purchasePrice") ELSE oi."totalPrice" END),0)::float as "grossProfit" FROM orders o JOIN order_items oi ON o.id=oi."orderId" LEFT JOIN frames f ON oi."frameId"=f.id LEFT JOIN lenses l ON oi."lensId"=l.id WHERE o."storeId"=${req.storeId} AND o.status!='CANCELLED' AND o."createdAt" BETWEEN ${dateFrom} AND ${dateTo}`;
    res.json({ success: true, data: data[0] });
  } catch (e) { next(e); }
});

module.exports = router;
