# 👁 GO-KOOL CHASMAGHAR — Optical Shop Management SaaS

A complete, production-ready Optical Shop Management & Billing System.

---

## 🚀 Quick Start (Docker — Recommended)

```bash
# 1. Clone / extract the project
cd GO-KOOL CHASMAGHAR

# 2. Start all services
docker compose up -d --build

# 3. Open the app
open http://localhost:5173
```

No demo credentials are bundled. Create your admin account via the seed configuration in `backend/.env`.

---

## 🛠️ Manual Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials + SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD

npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
# → API running at http://localhost:5000
```

### Frontend 

```bash
cd frontend
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:5000/api

npm install
npm run dev
# → App running at http://localhost:5173
```

---

## 📦 Project Structure

```
GO-KOOL CHASMAGHAR/
├── backend/
│   ├── src/
│   │   ├── index.js            # Express app entry
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT auth middleware
|   |   ├── controllers/
|   |   |   ├── accessoryController.js
|   |   |   ├── importController.js
|   |   |   ├── productController.js
|   |   |   ├── prescriptionController.js
|   |   |   └── invoice.js      # Invoice
│   │   ├── routes/
|   |   |   ├── accessories.js     # Products except frames & lenses.
│   │   │   ├── auth.js            # Login, users
|   |   |   ├── barcode.js         # Barcode
│   │   │   ├── customers.js       # Customer CRUD
│   │   │   ├── dashboard.js       # KPI dashboard
│   │   │   ├── frames.js          # Frame inventory
│   │   │   ├── inventory.js       # Stock management
│   │   │   ├── lenses.js          # Lens catalog
│   │   │   ├── orders.js          # Order
│   │   │   ├── payments.js        # Payment Method
│   │   │   ├── prescriptions.js   # Rx management
|   |   |   ├── product.js         # Product (Frames & Lens) to scan
│   │   │   ├── purchases.js       # Purchase orders
│   │   │   ├── reports.js         # Analytics
│   │   │   ├── stores.js          # Store settings
│   │   │   ├── suppliers.js       # Suppliers
│   │   │   └── upload.js          # Uploads
│   │   └── utils/
│   │       ├── calculatePay.js 
|   |       ├── excelParser.js
│   │       ├── pdfBrowser.js
│   │       ├── prisma.js       # DB client
│   │       └── logger.js       # Winston logger
│   ├── prisma/
|   |   ├── migrations/         # Migration in DB schema
│   │   ├── schema.prisma       # DB schema
│   │   └── seed.js             # Production bootstrap seed
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Routes
│   │   ├── index.css                 # React css file
│   │   ├── main.jsx                  # React file
│   │   ├── components/
│   │   │   ├── layout/         
│   │   │   |   └── AppLayout.jsx     # AppLayout, Sidebar
│   │   │   ├── ui/             
│   │   │   |   └── index.jsx         # Shared components
│   │   │   ├── BarcodeInput.jsx      # Barcode component  
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── Invoice.jsx       
|   |   |   └── Label.jsx             # Label for lenses, frames.
│   │   │   ├── Prescription.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx         # KPI + charts
│   │   │   ├── Customers.jsx         # Customer grid
│   │   │   ├── CustomerDetail.jsx    # History + Rx
│   │   │   ├── Frames.jsx            # Gallery + filters
│   │   │   ├── Lenses.jsx            # Lens packages
│   │   │   ├── Orders.jsx            # Order list
│   │   │   ├── OrderCreate.jsx       # 5-step wizard
│   │   │   ├── OrderDetail.jsx       # Timeline + bill
│   │   │   ├── Billing.jsx           # POS counter
│   │   │   ├── Inventory.jsx         # Stock levels
│   │   │   ├── Reports.jsx           # Analytics
│   │   │   └── Settings.jsx          # Config + users
│   │   ├── stores/
│   │   │   └── authStore.js    # Zustand auth
│   │   └── services/
│   │       └── api.js          # Axios instance
│   ├── Dockerfile
│   └── Index.html
│
└── docker-compose.yml
```

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `stores` | Multi-store support |
| `users` | Staff with roles (SUPER_ADMIN / SHOP_ADMIN / STAFF) |
| `customers` | Customer profiles |
| `prescriptions` | Optical Rx with OD/OS fields |
| `frames` | Frame inventory with barcode |
| `lenses` | Lens catalog with coatings |
| `accessories` | Accessories catalog |
| `orders` | Full order lifecycle |
| `order_items` | Line items per order |
| `payments` | Payment records |
| `order_status_logs` | Status audit trail |
| `stock_movements` | Inventory audit log |
| `suppliers` | Supplier directory |
| `purchases` | Purchase orders |

---

## 🔌 API Reference

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/change-password
GET    /api/auth/users             (admin)
POST   /api/auth/users             (admin)

GET    /api/dashboard

GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PUT    /api/customers/:id

GET    /api/prescriptions/customer/:customerId
POST   /api/prescriptions
GET    /api/prescriptions/:id

GET    /api/frames
POST   /api/frames
PUT    /api/frames/:id
DELETE /api/frames/:id
GET    /api/frames/barcode/:barcode
GET    /api/frames/low-stock

GET    /api/lenses
POST   /api/lenses
PUT    /api/lenses/:id

GET    /api/orders
POST   /api/orders
GET    /api/orders/:id
PATCH  /api/orders/:id/status
POST   /api/orders/:id/payment
DELETE /api/orders/:id             (admin)

GET    /api/inventory
GET    /api/inventory/movements
POST   /api/inventory/adjust

GET    /api/reports/sales
GET    /api/reports/frames
GET    /api/reports/customers
GET    /api/reports/profit

GET    /api/suppliers
POST   /api/suppliers
GET    /api/purchases
POST   /api/purchases

GET    /api/stores/current         (admin)
PUT    /api/stores/current         (admin)

POST   /api/upload
GET    /health
```

---

## ☁️ Deployment

### Railway.app (Easiest)
1. Push to GitHub
2. Connect Railway → New Project → Deploy from GitHub
3. Add PostgreSQL database from Railway dashboard
4. Set `DATABASE_URL` environment variable
5. Deploy!

### AWS / VPS
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone & start
git clone <repo>
cd GO-KOOL CHASMAGHAR
docker compose up -d --build
```

---

## ✨ Features

- **Dashboard** — Today's revenue, pending orders, low stock alerts, charts
- **Customer CRM** — Search, history, prescriptions
- **Prescription Management** — OD/OS table with SPH/CYL/AXIS/ADD/PD
- **Frame Gallery** — Grid/list view, brand filters, barcode lookup
- **Lens Catalog** — Packages with coatings, indices
- **5-Step Order Wizard** — Customer → Frame → Rx → Lens → Checkout
- **GST Billing** — Automatic 18% GST, discounts, multi-payment
- **Order Tracking** — CREATED → LENS_ORDERED → GRINDING → FITTING → READY → DELIVERED
- **Inventory** — Stock levels, adjustment, movement log
- **Reports** — Sales trend, frame report, top customers, profit margin
- **Settings** — Store config, user management, password change
- **Role-Based Access** — SUPER_ADMIN / SHOP_ADMIN / STAFF

---

*Built with Node.js, Express, PostgreSQL, Prisma, React 18, Vite, Tailwind CSS*

