const ACCESSORY_CATEGORIES = ['SUNGLASSES', 'CASE', 'SOLUTION', 'CLOTH', 'OTHER'];
const FRAME_SHAPES = ['ROUND', 'OVAL', 'RECTANGLE', 'SQUARE', 'CAT_EYE', 'AVIATOR', 'WAYFARER', 'GEOMETRIC', 'RIMLESS', 'SEMI_RIMLESS'];
const LENS_TYPES = ['SINGLE_VISION', 'BIFOCAL', 'PROGRESSIVE', 'READING'];
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'MIXED'];
const ORDER_STATUSES = ['CREATED', 'LENS_ORDERED', 'GRINDING', 'FITTING', 'READY', 'DELIVERED', 'CANCELLED'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

const enumValue = (value, allowed, fallback = undefined) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return allowed.includes(normalized) ? normalized : fallback;
};

const nullableString = value => {
  if (value === undefined) return undefined;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const numberOrNull = value => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const numberOrDefault = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const positiveInt = value => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

module.exports = {
  ACCESSORY_CATEGORIES,
  FRAME_SHAPES,
  LENS_TYPES,
  PAYMENT_METHODS,
  ORDER_STATUSES,
  GENDERS,
  enumValue,
  nullableString,
  numberOrNull,
  numberOrDefault,
  positiveInt,
};
