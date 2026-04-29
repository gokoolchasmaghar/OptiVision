const BARCODE_RE = /^\d{13}$/;

const isValidBarcode = value => BARCODE_RE.test(String(value || '').trim());

const generateBarcode = () => {
  let code = '';
  for (let i = 0; i < 13; i += 1) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
};

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

const createUniqueBarcode = async (prisma, reserved = new Set(), exclude) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const barcode = generateBarcode();
    if (reserved.has(barcode)) continue;
    if (await barcodeExists(prisma, barcode, exclude)) continue;
    reserved.add(barcode);
    return barcode;
  }

  throw new Error('Could not generate a unique barcode');
};

const resolveBarcode = async (prisma, value, reserved = new Set(), exclude) => {
  const barcode = String(value || '').trim();
  if (isValidBarcode(barcode) && !reserved.has(barcode) && !(await barcodeExists(prisma, barcode, exclude))) {
    reserved.add(barcode);
    return barcode;
  }

  return createUniqueBarcode(prisma, reserved, exclude);
};

module.exports = {
  isValidBarcode,
  resolveBarcode,
};
