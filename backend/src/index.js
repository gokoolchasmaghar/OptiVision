require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ CORS CONFIG - sabse pehle
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4173'
    ].filter(Boolean);
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// ✅ Preflight - CORS se pehle kuch nahi
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Security - CORS ke baad
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

// Trust proxy (Railway)
app.set('trust proxy', 1);

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
  stream: { write: m => logger.info(m.trim()) },
  skip: r => r.url === '/health'
}));

// Static
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// ✅ Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/frames', require('./routes/frames'));
app.use('/api/lenses', require('./routes/lenses'));
app.use('/api/accessories', require('./routes/accessories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/barcode', require('./routes/barcode'));
app.use('/api/import', require('./routes/import'));
app.use('/api/products', require('./routes/product'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.code === 'P2002') {
    status = 409;
    message = 'Duplicate record';
  }
  if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  }
  if (err.code === 'P2003') {
    status = 400;
    message = 'Invalid reference';
  }
  if (status >= 500) {
    logger.error(`${status} - ${message}`, { stack: err.stack });
  }

  res.status(status).json({
    success: false,
    message
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 GO-KOOL CHASMAGHAR API on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = app;