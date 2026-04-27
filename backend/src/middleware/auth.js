const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { store: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    req.user = user;
    // FIX: removed console.log("USER:", user) — was logging sensitive data in production

    req.storeId = user.storeId || user.store?.id;

    if (!req.storeId) {
      return res.status(401).json({ success: false, message: 'User has no store assigned' });
    }

    next();

  } catch (e) {
    return res.status(401).json({
      success: false,
      message: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

const requireAdmin = requireRole('SUPER_ADMIN', 'SHOP_ADMIN', 'Admin');

module.exports = { authenticate, requireRole, requireAdmin };