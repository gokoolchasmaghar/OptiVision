const router = require('express').Router();
const { getAccessoryByBarcode } = require('../controllers/accessoryController');

const {
  getAccessories,
  createAccessory,
  updateAccessory,
  deleteAccessory,
} = require('../controllers/accessoryController');

const { authenticate, requireAdmin } = require('../middleware/auth');

// 🔐 Protect all routes
router.use(authenticate);

// 📦 Routes
router.get('/', getAccessories); // staff allowed
router.post('/', requireAdmin, createAccessory);
router.get('/barcode/:barcode', getAccessoryByBarcode);
router.put('/:id', requireAdmin, updateAccessory);
router.delete('/:id', requireAdmin, deleteAccessory);

module.exports = router;