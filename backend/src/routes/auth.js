const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const sign = id => jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ success: false, errors: errs.array() });
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email }, include: { store: true } });
      if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      if (!await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
      const { passwordHash, ...safe } = user;
      res.json({ success: true, token: sign(user.id), user: safe });
    } catch (e) { next(e); }
  }
);

router.get('/me', authenticate, (req, res) => {
  const { passwordHash, ...safe } = req.user;
  res.json({ success: true, user: safe });
});

router.post('/change-password', authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ success: false, errors: errs.array() });
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash))
        return res.status(400).json({ success: false, message: 'Current password incorrect' });
      const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
      res.json({ success: true, message: 'Password changed' });
    } catch (e) { next(e); }
  }
);

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { storeId: req.storeId },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (e) { next(e); }
});

router.post('/users', authenticate, requireAdmin,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty(),
  body('role').isIn(['SHOP_ADMIN', 'STAFF']),
  async (req, res, next) => {
    try {
      const errs = validationResult(req);
      if (!errs.isEmpty()) return res.status(400).json({ success: false, errors: errs.array() });
      const { name, email, password, role, phone } = req.body;
      const user = await prisma.user.create({
        data: { storeId: req.storeId, name, email, phone, passwordHash: await bcrypt.hash(password, 12), role },
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true }
      });
      res.status(201).json({ success: true, data: user });
    } catch (e) { next(e); }
  }
);

router.patch('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { name, phone, role, isActive } = req.body;
    if (role && !['SHOP_ADMIN', 'STAFF'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // 🔒 Prevent admin modifying another admin
    const targetUser = await prisma.user.findFirst({
      where: { id: req.params.id, storeId: req.storeId }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Admin cannot modify another admin
    if (req.user.role === 'SHOP_ADMIN' && targetUser.role === 'SHOP_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify another admin'
      });
    }

    if (req.user.id === req.params.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate yourself'
      });
    }

    const result = await prisma.user.updateMany({
      where: { id: req.params.id, storeId: req.storeId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive })
      }
    });
    if (!result.count) return res.status(404).json({ success: false, message: 'User not found' });

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true }
    });
    res.json({ success: true, data: user });
  } catch (e) { next(e); }
});

module.exports = router;
