const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const EXPENSE_CATEGORIES = ['RENT', 'ELECTRICITY', 'TEA_SNACKS', 'TRANSPORT', 'MAINTENANCE', 'INTERNET', 'STATIONERY', 'OTHER'];
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'];
const SORT_FIELDS = ['createdAt', 'amount', 'category', 'paymentMode'];

router.use(authenticate);

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseDate = (value, label, endOfDay = false) => {
  if (!value) return null;
  const text = String(value);
  const date = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999` : text);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`Invalid ${label}`);
    err.status = 400;
    throw err;
  }
  return date;
};

const buildDateWhere = ({ dateFrom, dateTo }) => {
  const from = parseDate(dateFrom, 'dateFrom');
  const to = parseDate(dateTo, 'dateTo', true);
  if (from && to && from > to) {
    const err = new Error('dateFrom cannot be after dateTo');
    err.status = 400;
    throw err;
  }
  if (!from && !to) return {};
  return { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
};

const buildExpenseWhere = query => {
  const { category, paymentMode, search } = query;

  if (category && !EXPENSE_CATEGORIES.includes(category)) {
    const err = new Error('Invalid category');
    err.status = 400;
    throw err;
  }
  if (paymentMode && !PAYMENT_MODES.includes(paymentMode)) {
    const err = new Error('Invalid payment mode');
    err.status = 400;
    throw err;
  }

  const trimmedSearch = String(search || '').trim();
  return {
    storeId: query.storeId,
    ...(category ? { category } : {}),
    ...(paymentMode ? { paymentMode } : {}),
    ...buildDateWhere(query),
    ...(trimmedSearch
      ? {
          OR: [
            { description: { contains: trimmedSearch, mode: 'insensitive' } },
            { customCategoryName: { contains: trimmedSearch, mode: 'insensitive' } },
            { paidBy: { contains: trimmedSearch, mode: 'insensitive' } },
            { notes: { contains: trimmedSearch, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
};

const normalizeExpenseInput = (body, { partial = false, existingCategory = null } = {}) => {
  const data = {};
  const category = body.category !== undefined ? String(body.category).trim() : undefined;
  const effectiveCategory = category || existingCategory;

  if (!partial || category !== undefined) {
    if (!category || !EXPENSE_CATEGORIES.includes(category)) {
      const err = new Error('Invalid or missing category');
      err.status = 400;
      throw err;
    }
    data.category = category;
  }

  if (!partial || body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (!description) {
      const err = new Error('Description is required');
      err.status = 400;
      throw err;
    }
    data.description = description;
  }

  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const err = new Error('Amount must be greater than 0');
      err.status = 400;
      throw err;
    }
    data.amount = amount;
  }

  if (!partial || body.paymentMode !== undefined) {
    const paymentMode = String(body.paymentMode || '').trim();
    if (!paymentMode || !PAYMENT_MODES.includes(paymentMode)) {
      const err = new Error('Invalid or missing payment mode');
      err.status = 400;
      throw err;
    }
    data.paymentMode = paymentMode;
  }

  if (!partial || body.customCategoryName !== undefined || category !== undefined) {
    const customCategoryName = String(body.customCategoryName || '').trim();
    if (effectiveCategory === 'OTHER') {
      if (!customCategoryName) {
        const err = new Error('Custom category name is required for Other expenses');
        err.status = 400;
        throw err;
      }
      data.customCategoryName = customCategoryName;
    } else {
      data.customCategoryName = null;
    }
  }

  ['paidBy', 'notes', 'receiptUrl'].forEach(field => {
    if (!partial || body[field] !== undefined) {
      const value = String(body[field] || '').trim();
      data[field] = value || null;
    }
  });

  if (!partial || body.createdAt !== undefined) {
    if (body.createdAt) data.createdAt = parseDate(body.createdAt, 'createdAt');
  }

  return data;
};

const csvEscape = value => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// GET summary stats
router.get('/stats/summary', async (req, res, next) => {
  try {
    const where = buildExpenseWhere({ ...req.query, storeId: req.storeId });

    const [totalExpense, count, highestExpense] = await Promise.all([
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
      prisma.expense.count({ where }),
      prisma.expense.findFirst({
        where,
        orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          category: true,
          customCategoryName: true,
          description: true,
          amount: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalExpenses: totalExpense._sum.amount || 0,
        expenseCount: count,
        highestExpense,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET category summary
router.get('/summary/by-category', async (req, res, next) => {
  try {
    const where = buildExpenseWhere({ ...req.query, storeId: req.storeId });
    const summary = await prisma.expense.groupBy({
      by: ['category', 'customCategoryName'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const data = summary.map(item => ({
      category: item.category,
      customCategoryName: item.customCategoryName,
      label: item.category === 'OTHER' && item.customCategoryName ? item.customCategoryName : item.category,
      total: item._sum.amount || 0,
      count: item._count.id,
    }));

    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// GET CSV export
router.get('/export.csv', requireAdmin, async (req, res, next) => {
  try {
    const where = buildExpenseWhere({ ...req.query, storeId: req.storeId });
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { creator: { select: { name: true, email: true } } },
    });

    const header = ['Date', 'Category', 'Description', 'Amount', 'Payment Mode', 'Paid By', 'Notes', 'Receipt URL', 'Logged By'];
    const rows = expenses.map(expense => [
      expense.createdAt.toISOString(),
      expense.category === 'OTHER' && expense.customCategoryName ? expense.customCategoryName : expense.category,
      expense.description,
      Number(expense.amount || 0).toFixed(2),
      expense.paymentMode,
      expense.paidBy || '',
      expense.notes || '',
      expense.receiptUrl || '',
      expense.creator?.name || expense.creator?.email || '',
    ]);

    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=expenses-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    res.send(`\ufeff${csv}`);
  } catch (e) {
    next(e);
  }
});

// GET all expenses for store
router.get('/', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const sortBy = SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const where = buildExpenseWhere({ ...req.query, storeId: req.storeId });

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
        include: { creator: { select: { id: true, name: true } } },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    next(e);
  }
});

// GET expense by ID
router.get('/:id', async (req, res, next) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
      include: { creator: { select: { id: true, name: true, email: true } }, store: { select: { id: true, name: true } } },
    });

    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, data: expense });
  } catch (e) {
    next(e);
  }
});

// POST create expense
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = normalizeExpenseInput(req.body);
    const expense = await prisma.expense.create({
      data: {
        ...data,
        storeId: req.storeId,
        createdBy: req.user.id,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, data: expense });
  } catch (e) {
    next(e);
  }
});

// PUT update expense
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
    });

    if (!existing) return res.status(404).json({ success: false, message: 'Expense not found' });

    const data = normalizeExpenseInput(req.body, {
      partial: true,
      existingCategory: existing.category,
    });

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data,
      include: { creator: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: expense });
  } catch (e) {
    next(e);
  }
});

// DELETE expense
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, storeId: req.storeId },
    });

    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
