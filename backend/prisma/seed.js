// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding started...\n');

  // Read from env — set these in Railway env vars
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@gmail.com';
  const staffPassword = process.env.SEED_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    throw new Error('❌ SEED_ADMIN_PASSWORD and SEED_STAFF_PASSWORD must be set in env');
  }

  const store = await prisma.store.upsert({
    where: { id: 'store-optivision-001' },
    update: { name: 'OptiVision', isActive: true },
    create: {
      id: 'store-optivision-001',
      name: 'OptiVision',
      address: 'Main Branch, India',
      phone: '9999999999',
      email: adminEmail,
      gstEnabled: false,
      invoicePrefix: 'OV',
      invoiceCounter: 1000,
      isActive: true,
    }
  });
  console.log('✅ Store:', store.name);

  const adminHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, isActive: true, role: 'SHOP_ADMIN', storeId: store.id },
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

  const staffHash = await bcrypt.hash(staffPassword, 12);
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: { passwordHash: staffHash, isActive: true, storeId: store.id },
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
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); })
  .finally(async () => await prisma.$disconnect());