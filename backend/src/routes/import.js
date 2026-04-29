// backend/src/routes/import.js
const router = require('express').Router();
const multer = require('multer');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { importInventory, previewImport } = require('../controllers/importController');

// FIX: memory storage (no disk write needed — we process buffer directly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith('.csv') ||
               file.originalname.toLowerCase().endsWith('.xlsx');
    if (!ok) return cb(new Error('Only CSV or Excel files allowed'));
    cb(null, true);
  }
});

// FIX: authenticate middleware added — storeId needed for all imports
router.post('/preview', authenticate, requireAdmin, upload.single('file'), previewImport);
router.post('/', authenticate, requireAdmin, upload.single('file'), importInventory);

module.exports = router;
