const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, requireStaff, requireAdmin } = require('../middleware/auth');
const { GENDERS, enumValue, numberOrNull } = require('../utils/normalize');

router.use(authenticate);

router.get('/', requireStaff, async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20, gender } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      storeId: req.storeId,
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] }),
      ...(gender && { gender })
    };
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' }, include: { _count: { select: { orders: true, prescriptions: true } } } }),
      prisma.customer.count({ where })
    ]);
    res.json({ success: true, data: customers, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      include: {
        prescriptions: { orderBy: { date: 'desc' } },
        orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { items: true, payments: true } }
      }
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (e) { next(e); }
});

router.post('/', requireStaff, body('name').notEmpty(), body('phone').notEmpty(), async (req, res, next) => {
  try {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ success: false, errors: errs.array() });
    const { name, phone, email, address, gender, age, dateOfBirth, notes } = req.body;
    const finalGender = gender ? enumValue(gender, GENDERS) : null;
    if (gender && !finalGender) return res.status(400).json({ success: false, message: 'Invalid gender' });
    const customer = await prisma.customer.create({
      data: { storeId: req.storeId, name, phone, email, address, gender: finalGender, age: numberOrNull(age), dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, notes }
    });
    res.status(201).json({ success: true, data: customer });
  } catch (e) { next(e); }
});

router.put('/:id', requireStaff, async (req, res, next) => {
  try {
    const { name, phone, email, address, gender, age, dateOfBirth, notes } = req.body;
    const finalGender = gender !== undefined ? enumValue(gender, GENDERS) : undefined;
    if (gender && !finalGender) return res.status(400).json({ success: false, message: 'Invalid gender' });
    const r = await prisma.customer.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: { ...(name && { name }), ...(phone && { phone }), ...(email !== undefined && { email }), ...(address !== undefined && { address }), ...(gender !== undefined && { gender: finalGender }), ...(age !== undefined && { age: numberOrNull(age) }), ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }), ...(notes !== undefined && { notes }) }
    });
    if (!r.count) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: await prisma.customer.findUnique({ where: { id: req.params.id } }) });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      include: { _count: { select: { orders: true, prescriptions: true } } },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    if (customer._count.orders || customer._count.prescriptions) {
      return res.status(400).json({ success: false, message: 'Cannot delete customer with orders or prescriptions' });
    }
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
