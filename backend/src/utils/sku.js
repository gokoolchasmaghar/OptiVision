const makeSku = (prefix) => `${prefix}-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

const skuExists = async (prisma, model, sku, excludeId) => {
  const found = await prisma[model].findUnique({ where: { sku }, select: { id: true } });
  return Boolean(found && found.id !== excludeId);
};

const resolveSku = async (prisma, model, prefix, value, excludeId, reserved = new Set()) => {
  const input = String(value || '').trim();
  if (input && !reserved.has(input) && !(await skuExists(prisma, model, input, excludeId))) {
    reserved.add(input);
    return input;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const sku = makeSku(prefix);
    if (!reserved.has(sku) && !(await skuExists(prisma, model, sku, excludeId))) {
      reserved.add(sku);
      return sku;
    }
  }

  throw new Error('Could not generate a unique SKU');
};

module.exports = { resolveSku };
