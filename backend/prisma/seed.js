// backend/prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding started...\n');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@gmail.com';
  const staffPassword = process.env.SEED_STAFF_PASSWORD;
  const superEmail = process.env.SEED_SUPER_EMAIL || 'superadmin@gmail.com';
  const superPassword = process.env.SEED_SUPER_PASSWORD;

  if (!adminPassword || !staffPassword || !superPassword) {
    throw new Error('❌ SEED_ADMIN_PASSWORD, SEED_STAFF_PASSWORD and SEED_SUPER_PASSWORD must be set in env');
  }

  // Create store
  const store = await prisma.store.upsert({
    where: { id: 'store-GO-KOOL CHASMAGHAR-001' },
    update: { name: 'GO-KOOL CHASMAGHAR', isActive: true },
    create: {
      id: 'store-GO-KOOL CHASMAGHAR-001',
      name: 'GO-KOOL CHASMAGHAR',
      address: '235, Parbirata G.T. Road, Sripally Near State Bank of India Burdwan, Purba Bardhaman West Bengal - 713103',
      phone: '9832906048',
      email: 'gokoolchasmaghar.eyewear@gmail.com',
      gstEnabled: false,
      invoicePrefix: 'INVGC',
      invoiceCounter: 1,
      isActive: true,
    }
  });
  console.log('✅ Store:', store.name);

  // 🔥 SUPER ADMIN
  const superHash = await bcrypt.hash(superPassword, 12);

  await prisma.user.upsert({
    where: { email: superEmail },
    update: {
      passwordHash: superHash,
      isActive: true,
      role: 'SUPER_ADMIN',
      storeId: store.id // optional but safe
    },
    create: {
      storeId: store.id,
      name: 'Super Admin',
      email: superEmail,
      phone: '7777777777',
      passwordHash: superHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    }
  });
  console.log('✅ Super Admin:', superEmail);

  // Admin
  const adminHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminHash,
      isActive: true,
      role: 'SHOP_ADMIN',
      storeId: store.id
    },
    create: {
      storeId: store.id,
      name: 'Admin',
      email: adminEmail,
      phone: '9999999999',
      passwordHash: adminHash,
      role: 'SHOP_ADMIN',
      isActive: true,
    }
  });
  console.log('✅ Admin:', adminEmail);

  // Staff
  const staffHash = await bcrypt.hash(staffPassword, 12);

  await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      passwordHash: staffHash,
      isActive: true,
      storeId: store.id
    },
    create: {
      storeId: store.id,
      name: 'Staff',
      email: staffEmail,
      phone: '8888888888',
      passwordHash: staffHash,
      role: 'STAFF',
      isActive: true,
    }
  });
  console.log('✅ Staff:', staffEmail);

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());