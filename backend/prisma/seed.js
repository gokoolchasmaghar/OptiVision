const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 OptiVision Seeding started...\n');

  // ─── Step 1: Store ───────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { id: 'store-optivision-001' },
    update: {
      name: 'OptiVision',
      isActive: true,
    },
    create: {
      id: 'store-optivision-001',
      name: 'OptiVision',
      address: 'Main Branch, India',
      phone: '9999999999',
      email: 'info@optivision.in',
      gstEnabled: false,
      invoicePrefix: 'OV',
      invoiceCounter: 1000,
      isActive: true,
    }
  });
  console.log('✅ Store ready:', store.name, `(${store.id})`);

  // ─── Step 2: Admin User ──────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@optivision.in' },
    update: {
      passwordHash: adminHash,
      isActive: true,
      role: 'SHOP_ADMIN',
      storeId: store.id,
    },
    create: {
      storeId: store.id,
      name: 'Admin',
      email: 'admin@optivision.in',
      phone: '9999999999',
      passwordHash: adminHash,
      role: 'SHOP_ADMIN',
      isActive: true,
    }
  });
  console.log('✅ Admin ready:', admin.email);

  // ─── Step 3: Staff User ──────────────────────────────────
  const staffHash = await bcrypt.hash('Staff@123', 12);
  const staff = await prisma.user.upsert({
    where: { email: 'priya@optivision.in' },
    update: {
      passwordHash: staffHash,
      isActive: true,
      storeId: store.id,
    },
    create: {
      storeId: store.id,
      name: 'Priya Sharma',
      email: 'priya@optivision.in',
      phone: '8888888888',
      passwordHash: staffHash,
      role: 'STAFF',
      isActive: true,
    }
  });
  console.log('✅ Staff ready:', staff.email);

  // ─── Done ────────────────────────────────────────────────
  console.log('\n🎉 Seeding complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 Admin  → admin@optivision.in / Admin@123');
  console.log('👤 Staff  → priya@optivision.in / Staff@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });