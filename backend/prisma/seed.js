const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OptiVision...');

  const store = await prisma.store.upsert({
    where: { id: 'store-main-01' },
    update: {},
    create: { id: 'store-main-01', name: 'OptiVision Optical Store', address: '123 Vision Street, Andheri West, Mumbai - 400053', phone: '+91-9876543210', email: 'info@optivision.in', gstNumber: '27AABCU9603R1ZX', gstEnabled: true, taxRate: 18, invoicePrefix: 'INV', invoiceCounter: 1050 }
  });

  const generateEAN13 = () => {
    const randomDigits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));

    const checksum =
      randomDigits.reduce((sum, digit, index) => {
        return sum + digit * (index % 2 === 0 ? 1 : 3);
      }, 0);

    const checkDigit = (10 - (checksum % 10)) % 10;

    return [...randomDigits, checkDigit].join('');
  };

  const generateSku = (prefix) => (
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
  );

  const hasColumn = async (tableName, columnName) => {
    const rows = await prisma.$queryRaw`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ${tableName}
        AND column_name = ${columnName}
      LIMIT 1
    `;

    return rows.length > 0;
  };

  // Bring older local databases up to the current Prisma inventory shape.
  const ensureInventoryTableSchema = async (tableName, prefix) => {
    if (!(await hasColumn(tableName, 'barcode'))) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "barcode" TEXT`);
    }

    if (!(await hasColumn(tableName, 'sku'))) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "sku" TEXT`);
    }

    if (!(await hasColumn(tableName, 'modelCode'))) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "modelCode" TEXT`);
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "${tableName}"
      SET "barcode" = CONCAT('${prefix}-BAR-', REPLACE("id", '-', ''))
      WHERE "barcode" IS NULL OR "barcode" = ''
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "${tableName}"
      SET "sku" = CONCAT('${prefix}-SKU-', REPLACE("id", '-', ''))
      WHERE "sku" IS NULL OR "sku" = ''
    `);

    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ALTER COLUMN "barcode" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ALTER COLUMN "sku" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_barcode_key" ON "${tableName}"("barcode")`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_sku_key" ON "${tableName}"("sku")`);
  };

  await ensureInventoryTableSchema('frames', 'FRM');
  await ensureInventoryTableSchema('lenses', 'LNS');
  await ensureInventoryTableSchema('accessories', 'ACC');

  const adminHash = await bcrypt.hash('Admin@123', 12);
  const staffHash = await bcrypt.hash('Staff@123', 12);

  await prisma.user.upsert({ where: { email: 'admin@optivision.in' }, update: {}, create: { storeId: store.id, name: 'Admin User', email: 'admin@optivision.in', phone: '+91-9876543210', passwordHash: adminHash, role: 'SHOP_ADMIN' } });
  const staff = await prisma.user.upsert({ where: { email: 'priya@optivision.in' }, update: {}, create: { storeId: store.id, name: 'Priya Sharma', email: 'priya@optivision.in', phone: '+91-9876543211', passwordHash: staffHash, role: 'STAFF' } });
  await prisma.user.upsert({ where: { email: 'rahul@optivision.in' }, update: {}, create: { storeId: store.id, name: 'Rahul Verma', email: 'rahul@optivision.in', phone: '+91-9876543212', passwordHash: staffHash, role: 'STAFF' } });

  const s1 = await prisma.supplier.create({ data: { storeId: store.id, name: 'Titan EyePlus Pvt Ltd', phone: '+91-8765432109', email: 'supply@titan.com', address: 'Bengaluru' } });
  const s2 = await prisma.supplier.create({ data: { storeId: store.id, name: 'Luxottica India', phone: '+91-7654321098', email: 'india@luxottica.com', address: 'Mumbai' } });
  const s3 = await prisma.supplier.create({ data: { storeId: store.id, name: 'Essilor India', phone: '+91-9988776655', email: 'orders@essilor.in', address: 'Gurgaon' } });
  const s4 = await prisma.supplier.create({ data: { storeId: store.id, name: 'Hoya Lens India', phone: '+91-9977665544', email: 'supply@hoya.in', address: 'Delhi' } });
  console.log('✅ Suppliers');

  const framesData = [
    { frameCode: 'TIT-001', brand: 'Titan', model: 'Octane', shape: 'RECTANGLE', size: 'Medium', color: 'Gunmetal', material: 'Metal', gender: 'Unisex', purchasePrice: 800, sellingPrice: 1999, stockQty: 15, lowStockAlert: 5, barcode: 'TIT001', supplierId: s1.id },
    { frameCode: 'TIT-002', brand: 'Titan', model: 'Edge', shape: 'SQUARE', size: 'Large', color: 'Black', material: 'Acetate', gender: 'Male', purchasePrice: 950, sellingPrice: 2499, stockQty: 12, lowStockAlert: 4, barcode: 'TIT002', supplierId: s1.id },
    { frameCode: 'TIT-003', brand: 'Titan', model: 'Glam', shape: 'CAT_EYE', size: 'Medium', color: 'Rose Gold', material: 'Metal', gender: 'Female', purchasePrice: 900, sellingPrice: 2299, stockQty: 8, lowStockAlert: 4, barcode: 'TIT003', supplierId: s1.id },
    { frameCode: 'RAY-001', brand: 'Ray-Ban', model: 'RB5154 Clubmaster', shape: 'WAYFARER', size: 'Medium', color: 'Tortoise', material: 'Acetate', gender: 'Unisex', purchasePrice: 3500, sellingPrice: 8499, stockQty: 8, lowStockAlert: 3, barcode: 'RAY001', supplierId: s2.id },
    { frameCode: 'RAY-002', brand: 'Ray-Ban', model: 'RB4242 Aviator', shape: 'AVIATOR', size: 'Large', color: 'Gold', material: 'Metal', gender: 'Male', purchasePrice: 4200, sellingPrice: 9999, stockQty: 6, lowStockAlert: 2, barcode: 'RAY002', supplierId: s2.id },
    { frameCode: 'RAY-003', brand: 'Ray-Ban', model: 'RB7047 Round', shape: 'ROUND', size: 'Small', color: 'Matte Black', material: 'Plastic', gender: 'Unisex', purchasePrice: 2800, sellingPrice: 6999, stockQty: 10, lowStockAlert: 3, barcode: 'RAY003', supplierId: s2.id },
    { frameCode: 'LNK-001', brand: 'Lenskart', model: 'Air Classic', shape: 'OVAL', size: 'Medium', color: 'Silver', material: 'Metal', gender: 'Female', purchasePrice: 400, sellingPrice: 999, stockQty: 25, lowStockAlert: 8, barcode: 'LNK001', supplierId: s1.id },
    { frameCode: 'LNK-002', brand: 'Lenskart', model: 'Air Pro', shape: 'CAT_EYE', size: 'Medium', color: 'Rose Gold', material: 'Metal', gender: 'Female', purchasePrice: 600, sellingPrice: 1499, stockQty: 18, lowStockAlert: 6, barcode: 'LNK002', supplierId: s1.id },
    { frameCode: 'FAS-001', brand: 'Fastrack', model: 'Reflex', shape: 'RECTANGLE', size: 'Medium', color: 'Blue', material: 'Plastic', gender: 'Male', purchasePrice: 350, sellingPrice: 899, stockQty: 3, lowStockAlert: 5, barcode: 'FAS001', supplierId: s1.id },
    { frameCode: 'FAS-002', brand: 'Fastrack', model: 'Sportz', shape: 'GEOMETRIC', size: 'Large', color: 'Red', material: 'TR90', gender: 'Male', purchasePrice: 500, sellingPrice: 1299, stockQty: 20, lowStockAlert: 6, barcode: 'FAS002', supplierId: s1.id },
    { frameCode: 'TOM-001', brand: 'Tom Ford', model: 'TF5401 Tortoise', shape: 'ROUND', size: 'Medium', color: 'Havana', material: 'Acetate', gender: 'Unisex', purchasePrice: 8000, sellingPrice: 18999, stockQty: 4, lowStockAlert: 2, barcode: 'TOM001', supplierId: s2.id },
    { frameCode: 'OPV-001', brand: 'OptiVision', model: 'OV-Classic', shape: 'RECTANGLE', size: 'Medium', color: 'Black', material: 'Acetate', gender: 'Unisex', purchasePrice: 200, sellingPrice: 699, stockQty: 0, lowStockAlert: 10, barcode: 'OPV001', supplierId: s1.id },
  ];

  const frames = [];
  for (const f of framesData) {
    const frame = await prisma.frame.create({
      data: {
        storeId: store.id,
        ...f,
        barcode: generateEAN13(),
        sku: `SKU-${Date.now()}${Math.floor(Math.random() * 1000)}`,
      }
    });
    frames.push(frame);
  }
  console.log(`✅ ${frames.length} frames`);

  const lensesData = [
    { name: 'Basic Clear (1.50)', lensType: 'SINGLE_VISION', lensIndex: '1.50', coating: ['Anti-Glare'], brand: 'Essilor', purchasePrice: 300, sellingPrice: 799, stockQty: 200, supplierId: s3.id },
    { name: 'Standard Blue Cut (1.56)', lensType: 'SINGLE_VISION', lensIndex: '1.56', coating: ['Blue Cut', 'Anti-Glare'], brand: 'Essilor', purchasePrice: 500, sellingPrice: 1299, stockQty: 150, supplierId: s3.id },
    { name: 'Premium High Index (1.61)', lensType: 'SINGLE_VISION', lensIndex: '1.61', coating: ['Blue Cut', 'Anti-Glare', 'Anti-Scratch'], brand: 'Zeiss', purchasePrice: 1200, sellingPrice: 2999, stockQty: 80, supplierId: s3.id },
    { name: 'Ultra Thin Progressive (1.67)', lensType: 'PROGRESSIVE', lensIndex: '1.67', coating: ['Blue Cut', 'Anti-Glare', 'Anti-Scratch', 'UV400'], brand: 'Zeiss', purchasePrice: 3000, sellingPrice: 7499, stockQty: 40, supplierId: s3.id },
    { name: 'Super High Index (1.74)', lensType: 'SINGLE_VISION', lensIndex: '1.74', coating: ['Blue Cut', 'Anti-Glare', 'Anti-Scratch', 'UV400'], brand: 'Hoya', purchasePrice: 4000, sellingPrice: 9999, stockQty: 20, supplierId: s4.id },
    { name: 'Bifocal D28 (1.56)', lensType: 'BIFOCAL', lensIndex: '1.56', coating: ['Anti-Glare'], brand: 'Essilor', purchasePrice: 600, sellingPrice: 1599, stockQty: 60, supplierId: s3.id },
    { name: 'Progressive Standard (1.56)', lensType: 'PROGRESSIVE', lensIndex: '1.56', coating: ['Anti-Glare', 'Anti-Scratch'], brand: 'Essilor', purchasePrice: 1800, sellingPrice: 4499, stockQty: 50, supplierId: s3.id },
    { name: 'Photochromic Sensity (1.61)', lensType: 'SINGLE_VISION', lensIndex: '1.61', coating: ['Photochromic', 'Anti-Glare', 'Blue Cut'], brand: 'Hoya', purchasePrice: 2000, sellingPrice: 4999, stockQty: 3, supplierId: s4.id },
  ];

  const lenses = [];
  for (const l of lensesData) {
    const lens = await prisma.lens.create({
      data: {
        storeId: store.id,
        ...l,
        barcode: generateEAN13(),
        sku: generateSku('LNS'),
      }
    });
    lenses.push(lens);
  }
  console.log(`✅ ${lenses.length} lenses`);

  const accData = [
    { name: 'Lens Cleaning Solution 100ml', category: 'Cleaning', purchasePrice: 50, sellingPrice: 149, stockQty: 50 },
    { name: 'Microfiber Cleaning Cloth', category: 'Cleaning', purchasePrice: 20, sellingPrice: 79, stockQty: 100 },
    { name: 'Hard Premium Case', category: 'Case', purchasePrice: 80, sellingPrice: 249, stockQty: 30 },
    { name: 'Soft Pouch Case', category: 'Case', purchasePrice: 30, sellingPrice: 99, stockQty: 60 },
    { name: 'Nose Pads Silicone', category: 'Parts', purchasePrice: 10, sellingPrice: 49, stockQty: 200 },
    { name: 'Spectacle Chain Gold', category: 'Accessories', purchasePrice: 25, sellingPrice: 99, stockQty: 40 },
  ];
  for (const a of accData) {
    await prisma.accessory.create({
      data: {
        storeId: store.id,
        ...a,
        barcode: generateEAN13(),
        sku: generateSku('ACC'),
      }
    });
  }
  console.log('✅ Accessories');

  const customersData = [
    { name: 'Rajesh Kumar', phone: '+91-9812345678', email: 'rajesh@email.com', address: 'Andheri West, Mumbai', gender: 'MALE', age: 38 },
    { name: 'Priya Patel', phone: '+91-9823456789', email: 'priya@email.com', address: 'Bandra East, Mumbai', gender: 'FEMALE', age: 29 },
    { name: 'Amit Shah', phone: '+91-9834567890', email: 'amit@email.com', address: 'Juhu, Mumbai', gender: 'MALE', age: 45 },
    { name: 'Sunita Mehta', phone: '+91-9845678901', address: 'Powai, Mumbai', gender: 'FEMALE', age: 52 },
    { name: 'Kavita Desai', phone: '+91-9856789012', email: 'kavita@email.com', address: 'Kandivali, Mumbai', gender: 'FEMALE', age: 34 },
    { name: 'Vivek Sharma', phone: '+91-9867890123', address: 'Malad, Mumbai', gender: 'MALE', age: 27 },
    { name: 'Anita Joshi', phone: '+91-9878901234', email: 'anita@email.com', address: 'Borivali, Mumbai', gender: 'FEMALE', age: 41 },
    { name: 'Suresh Nair', phone: '+91-9889012345', address: 'Vile Parle, Mumbai', gender: 'MALE', age: 58 },
  ];

  const customers = [];
  for (const c of customersData) {
    customers.push(await prisma.customer.create({ data: { storeId: store.id, ...c } }));
  }
  console.log(`✅ ${customers.length} customers`);

  const rxData = [
    { customerId: customers[0].id, doctorName: 'Dr. Priya Sharma', rightSph: -1.5, rightCyl: -0.5, rightAxis: 180, leftSph: -1.75, leftCyl: -0.25, leftAxis: 175, pd: 63 },
    { customerId: customers[1].id, doctorName: 'Dr. Ramesh Iyer', rightSph: -2.0, rightCyl: 0, rightAxis: 0, leftSph: -2.25, leftCyl: -0.5, leftAxis: 90, pd: 60 },
    { customerId: customers[2].id, doctorName: 'Dr. Nair', rightSph: 1.0, rightCyl: -0.25, rightAxis: 90, leftSph: 1.25, leftCyl: 0, leftAxis: 0, rightAdd: 1.5, leftAdd: 1.5, pd: 65 },
    { customerId: customers[3].id, doctorName: 'Dr. Mehta', rightSph: 0.5, rightCyl: -0.75, rightAxis: 45, leftSph: 0.75, leftCyl: -0.5, leftAxis: 60, rightAdd: 2.0, leftAdd: 2.0, pd: 62 },
    { customerId: customers[4].id, doctorName: 'Dr. Gupta', rightSph: -3.0, rightCyl: -1.0, rightAxis: 180, leftSph: -3.25, leftCyl: -0.75, leftAxis: 175, pd: 61 },
  ];
  const prescriptions = [];
  for (const rx of rxData) prescriptions.push(await prisma.prescription.create({ data: rx }));
  console.log(`✅ ${prescriptions.length} prescriptions`);

  // Create orders
  const orderDefs = [
    { c: 0, rx: 0, f: 0, l: 1, status: 'DELIVERED', method: 'UPI', adv: 4000, days: 15 },
    { c: 1, rx: 1, f: 3, l: 0, status: 'READY', method: 'CASH', adv: 5000, days: 3 },
    { c: 2, rx: 2, f: 6, l: 6, status: 'FITTING', method: 'CARD', adv: 3000, days: 2 },
    { c: 3, rx: 3, f: 10, l: 3, status: 'GRINDING', method: 'CARD', adv: 15000, days: 1 },
    { c: 4, rx: 4, f: 4, l: 2, status: 'LENS_ORDERED', method: 'UPI', adv: 8000, days: 0 },
    { c: 5, rx: null, f: 8, l: 0, status: 'DELIVERED', method: 'CASH', adv: 0, days: 7 },
  ];

  for (let i = 0; i < orderDefs.length; i++) {
    const od = orderDefs[i];
    const date = new Date(); date.setDate(date.getDate() - od.days);
    const frame = frames[od.f]; const lens = lenses[od.l];
    const fPrice = frame.sellingPrice; const lPrice = lens.sellingPrice * 2;
    const subtotal = fPrice + lPrice;
    const tax = subtotal * 0.18;
    const total = subtotal + tax;
    const advanceAmount = od.adv ?? total;
    const orderNum = `INV-${1001 + i}`;

    await prisma.order.upsert({
      where: { orderNumber: orderNum },
      update: {},
      create: {
        storeId: store.id, orderNumber: orderNum,
        customerId: customers[od.c].id,
        prescriptionId: od.rx !== null ? prescriptions[od.rx].id : null,
        staffId: staff.id,
        frameDetails: `${frame.brand} ${frame.model} - ${frame.color}`,
        lensDetails: `${lens.name} x2`,
        subtotal, discountAmount: 0, taxAmount: tax, taxPct: 18, totalAmount: total,
        advanceAmount, balanceAmount: Math.max(0, total - advanceAmount),
        status: od.status, paymentMethod: od.method,
        paymentStatus: advanceAmount >= total ? 'PAID' : advanceAmount > 0 ? 'PARTIAL' : 'PENDING',
        deliveryDate: new Date(date.getTime() + 4 * 86400000),
        createdAt: date,
        items: {
          create: [
            { itemType: 'frame', frameId: frame.id, name: `${frame.brand} ${frame.model}`, quantity: 1, unitPrice: fPrice, totalPrice: fPrice },
            { itemType: 'lens', lensId: lens.id, name: lens.name, quantity: 2, unitPrice: lens.sellingPrice, totalPrice: lPrice }
          ]
        },
        statusLogs: { create: { status: 'CREATED', note: 'Order created', changedAt: date } },
        ...(od.adv > 0 ? { payments: { create: [{ amount: od.adv, method: od.method, note: 'Advance', paidAt: date }] } } : {})
      }
    });
  }
  console.log(`✅ ${orderDefs.length} orders`);

  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────');
  console.log('Admin:  admin@optivision.in / Admin@123');
  console.log('Staff:  priya@optivision.in / Staff@123');
  console.log('─────────────────────────────────────');
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
