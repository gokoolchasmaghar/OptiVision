const router = require('express').Router();
const { scanProduct } = require('../controllers/productController');

// optional: add auth if your app uses it
// const { authenticate } = require('../middleware/auth');
// router.use(authenticate);

router.get('/scan/:barcode', scanProduct);

module.exports = router;