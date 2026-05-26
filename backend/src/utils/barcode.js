const normalizeBarcode = value => {
  if (value === undefined || value === null) return '';
  return String(value);
};

const isValidBarcode = value => normalizeBarcode(value).length > 0;

const makeBarcode = () => `BC-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

const barcodeExists = async (prisma, barcode, exclude = {}) => {
  const [frame, lens, accessory] = await Promise.all([
    prisma.frame.findUnique({ where: { barcode }, select: { id: true } }),
    prisma.lens.findUnique({ where: { barcode }, select: { id: true } }),
    prisma.accessory.findUnique({ where: { barcode }, select: { id: true } }),
  ]);
  return Boolean(
    (frame && !(exclude.model === 'frame' && exclude.id === frame.id)) ||
    (lens && !(exclude.model === 'lens' && exclude.id === lens.id)) ||
    (accessory && !(exclude.model === 'accessory' && exclude.id === accessory.id))
  );
};

const resolveBarcode = async (prisma, value, reserved = new Set(), exclude) => {
  const input = normalizeBarcode(value).trim();
  if (isValidBarcode(input)) {
    if (reserved.has(input) || await barcodeExists(prisma, input, exclude)) {
      throw new Error('Barcode already exists');
    }

    reserved.add(input);
    return input;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const barcode = makeBarcode();
    if (!reserved.has(barcode) && !(await barcodeExists(prisma, barcode, exclude))) {
      reserved.add(barcode);
      return barcode;
    }
  }

  throw new Error('Could not generate a unique barcode');
};

module.exports = {
  isValidBarcode,
  resolveBarcode,
};
