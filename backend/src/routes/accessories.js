const router = require('express').Router();

const {
  getAccessories,
  createAccessory,
  updateAccessory,
  deleteAccessory,
} = require('../controllers/accessoryController');

const { authenticate } = require('../middleware/auth');

// 🔐 Protect all routes
router.use(authenticate);

// 📦 Routes
router.get('/', getAccessories);
router.post('/', createAccessory);
router.put('/:id', updateAccessory);
router.delete('/:id', deleteAccessory);

module.exports = router;