require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

async function main() {
  console.log('Bootstrapping production seed...');

  const storeId = process.env.SEED_STORE_ID || 'store-main-01';
  const storeName = process.env.SEED_STORE_NAME || 'OptiVision';
  const store = await prisma.store.upsert({
    where: { id: storeId },
    update: {
      name: storeName,
      address: process.env.SEED_STORE_ADDRESS || null,
      phone: process.env.SEED_STORE_PHONE || null,
      email: process.env.SEED_STORE_EMAIL || null,
      gstNumber: process.env.SEED_STORE_GST_NUMBER || null,
      gstEnabled: String(process.env.SEED_STORE_GST_ENABLED || 'false').toLowerCase() === 'true',
      taxRate: Number(process.env.SEED_STORE_TAX_RATE || 18),
      invoicePrefix: process.env.SEED_INVOICE_PREFIX || 'INV',
    },
    create: {
      id: storeId,
      name: storeName,
      address: process.env.SEED_STORE_ADDRESS || null,
      phone: process.env.SEED_STORE_PHONE || null,
      email: process.env.SEED_STORE_EMAIL || null,
      gstNumber: process.env.SEED_STORE_GST_NUMBER || null,
      gstEnabled: String(process.env.SEED_STORE_GST_ENABLED || 'false').toLowerCase() === 'true',
      taxRate: Number(process.env.SEED_STORE_TAX_RATE || 18),
      invoicePrefix: process.env.SEED_INVOICE_PREFIX || 'INV',
    }
  });

  const adminEmail = getRequiredEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const adminPassword = getRequiredEnv('SEED_ADMIN_PASSWORD');
  const adminName = process.env.SEED_ADMIN_NAME || 'System Administrator';
  const adminPhone = process.env.SEED_ADMIN_PHONE || null;
  const adminRole = process.env.SEED_ADMIN_ROLE || 'SHOP_ADMIN';

  if (!['SUPER_ADMIN', 'SHOP_ADMIN'].includes(adminRole)) {
    throw new Error('SEED_ADMIN_ROLE must be SUPER_ADMIN or SHOP_ADMIN');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      storeId: store.id,
      name: adminName,
      phone: adminPhone,
      role: adminRole,
      isActive: true,
    },
    create: {
      storeId: store.id,
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      role: adminRole,
      passwordHash, // ✅ only set during creation
      isActive: true,
    }
  });

  console.log('Production seed completed.');
  console.log(`Admin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
