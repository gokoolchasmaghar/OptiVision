const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;

const GST_DEFAULTS = {
  frame: { hsn: '9003', gstRate: 5, description: 'Spectacle Frames' },
  lens: { hsn: '9001', gstRate: 5, description: 'Spectacle Lenses' },
  accessory: { hsn: '9004', gstRate: 18, description: 'Optical Accessories' },
};

const normalizeProductType = value => {
  const type = String(value || '').toLowerCase();
  if (type === 'frames') return 'frame';
  if (type === 'lenses') return 'lens';
  if (type === 'accessories') return 'accessory';
  return GST_DEFAULTS[type] ? type : 'accessory';
};

const getProductGSTDefault = type => GST_DEFAULTS[normalizeProductType(type)];

const getFrameGSTMapping = () => getProductGSTDefault('frame');
const getLensGSTMapping = () => getProductGSTDefault('lens');
const getAccessoryGSTMapping = () => getProductGSTDefault('accessory');

const calculateGST = (amount, gstRate, isInclusive = false) => {
  const lineAmount = roundMoney(amount);
  const rate = Math.max(0, Number(gstRate) || 0);

  if (rate <= 0) {
    return { taxableValue: lineAmount, gstAmount: 0, totalAmount: lineAmount };
  }

  if (isInclusive) {
    const taxableValue = roundMoney(lineAmount / (1 + rate / 100));
    const gstAmount = roundMoney(lineAmount - taxableValue);
    return { taxableValue, gstAmount, totalAmount: lineAmount };
  }

  const gstAmount = roundMoney(lineAmount * rate / 100);
  return {
    taxableValue: lineAmount,
    gstAmount,
    totalAmount: roundMoney(lineAmount + gstAmount),
  };
};

const calculateOrderLineGST = ({
  itemType,
  quantity = 1,
  unitPrice = 0,
  discountAmount,
  discountPct,
  hsn,
  gstRate,
  rateInclusiveOfGst = false,
  gstEnabled = true,
}) => {
  const qty = Math.max(1, Number(quantity) || 1);
  const unit = Math.max(0, Number(unitPrice) || 0);
  const grossAmount = roundMoney(qty * unit);
  const rawDiscount = discountAmount !== undefined
    ? Number(discountAmount) || 0
    : grossAmount * (Math.max(0, Number(discountPct) || 0) / 100);
  const safeDiscount = Math.min(Math.max(roundMoney(rawDiscount), 0), grossAmount);
  const lineAmount = roundMoney(grossAmount - safeDiscount);
  const defaults = getProductGSTDefault(itemType);
  const finalRate = gstEnabled ? Math.max(0, Number(gstRate ?? defaults.gstRate) || 0) : 0;
  const inclusive = gstEnabled && rateInclusiveOfGst === true;
  const gst = calculateGST(lineAmount, finalRate, inclusive);
  const payableAmount = roundMoney(gst.totalAmount);

  return {
    quantity: qty,
    unitPrice: unit,
    grossAmount,
    discountAmount: safeDiscount,
    discountPct: grossAmount > 0 ? roundMoney((safeDiscount / grossAmount) * 100) : 0,
    totalPrice: lineAmount,
    hsn: hsn || defaults.hsn,
    gstRate: finalRate,
    rateInclusiveOfGst: inclusive,
    taxableValue: gst.taxableValue,
    gstAmount: gst.gstAmount,
    payableAmount,
  };
};

const summarizeGST = items => items.reduce((summary, item) => ({
  taxableValue: roundMoney(summary.taxableValue + Number(item.taxableValue || 0)),
  gstAmount: roundMoney(summary.gstAmount + Number(item.gstAmount || 0)),
  payableAmount: roundMoney(
    summary.payableAmount
    + Number(item.payableAmount ?? (Number(item.taxableValue || 0) + Number(item.gstAmount || 0)))
  ),
}), {
  taxableValue: 0,
  gstAmount: 0,
  payableAmount: 0,
});

const getAllGSTMappings = () => GST_DEFAULTS;

module.exports = {
  GST_DEFAULTS,
  GST_MAPPINGS: GST_DEFAULTS,
  getProductGSTDefault,
  getFrameGSTMapping,
  getLensGSTMapping,
  getAccessoryGSTMapping,
  calculateGST,
  calculateOrderLineGST,
  summarizeGST,
  getAllGSTMappings,
};
