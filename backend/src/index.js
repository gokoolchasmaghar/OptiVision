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

// app.use(express.static(path.join(__dirname, "../frontend/dist")));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
// });

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const normalizeOrigin = (origin = '') => origin.trim().replace(/\/+$/, '');

const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const originMatchers = configuredOrigins.map(value => {
  if (value.includes('*')) {
    const pattern = value
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`);
  }
  return value;
});

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    const allowed = originMatchers.some(m => (typeof m === 'string' ? m === normalized : m.test(normalized)));
    if (allowed) return callback(null, true);

    logger.warn(`CORS blocked origin: ${normalized}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: m => logger.info(m.trim()) }, skip: r => r.url === '/health' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.send('OK');
});

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/stores',       require('./routes/stores'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/prescriptions',require('./routes/prescriptions'));
app.use('/api/frames',       require('./routes/frames'));
app.use('/api/lenses',       require('./routes/lenses'));
app.use('/api/accessories',  require('./routes/accessories'));
app.use('/api/orders',       require('./routes/orders'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/inventory',    require('./routes/inventory'));
app.use('/api/suppliers',    require('./routes/suppliers'));
app.use('/api/purchases',    require('./routes/purchases'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/upload',       require('./routes/upload'));
app.use('/api/barcode',      require('./routes/barcode'));

app.get('/health', (req, res) => res.json({ status: 'healthy', version: '2.0.0', timestamp: new Date().toISOString() }));

// Error handling
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';
  if (err.code === 'P2002') { status = 409; message = 'Duplicate record'; }
  if (err.code === 'P2025') { status = 404; message = 'Record not found'; }
  if (err.code === 'P2003') { status = 400; message = 'Invalid reference'; }
  if (status >= 500) logger.error(`${status} - ${message}`, { stack: err.stack });
  res.status(status).json({ success: false, message });
});

const server = app.listen(PORT, () => logger.info(`🚀 OptiVision API on port ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
module.exports = app;
