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

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Simplified CORS
const corsOptions = {
  origin: [
    'https://opti-vision-plum.vercel.app',  // Production Vercel URL
    'http://localhost:5173',                  // Local development (Vite)
    'http://localhost:3000'                   // Alternative local (Next.js)
  ],
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

// Health check
app.get('/health', (req, res) => res.json({ status: 'healthy', version: '2.0.0', timestamp: new Date().toISOString() }));

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