const prisma = require('../utils/prisma');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { Readable } = require('stream');
const { isValidBarcode, resolveBarcode } = require('../utils/barcode');
const { resolveSku } = require('../utils/sku');
const { ACCESSORY_CATEGORIES, FRAME_SHAPES, LENS_TYPES, enumValue, numberOrDefault } = require('../utils/normalize');

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCSV(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        Readable.from([buffer.toString()])
            .pipe(csv())
            .on('data', d => results.push(d))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// ── Parse Excel ───────────────────────────────────────────────────────────────
function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
}

// ── Normalize row keys to lowercase trimmed ───────────────────────────────────
function normalizeRow(raw) {
    return Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [
            k.trim().toLowerCase().replace(/\s+/g, ''),
            typeof v === 'string' ? v.trim() : v
        ])
    );
}

// ── Validation ────────────────────────────────────────────────────────────────
// FIX: removed console.log("ERROR:", error) — error was undefined → crashed everything
function validateRow(type, row) {
    const price = row.sellingprice || row.price;
    const name = row.name || row.brand;

    if (!name) return 'Name / Brand is required';
    if (!price || isNaN(Number(price))) return 'Valid selling price is required';

    if (type === 'frame') {
        if (!row.model) return 'Model is required';
        if (!row.stockqty) return 'Stock quantity is required';
    }

    if (type === 'lens') {
        if ((row.lenstype || row.type) && !enumValue(row.lenstype || row.type, LENS_TYPES)) {
            return 'Invalid lens type';
        }
        if (!row.lenstype && !row.type) {
            return 'Lens type is required';
        }
    }

    if (type === 'accessory' && row.category && !enumValue(row.category, ACCESSORY_CATEGORIES)) {
        return 'Invalid accessory category';
    }

    return null;
}

// ── Build Prisma data objects ─────────────────────────────────────────────────
function cleanBarcode(value) {
    const barcode = value?.toString().trim();
    return isValidBarcode(barcode) ? barcode : null;
}

function buildFrameData(row, storeId, barcode, sku) {
    const price = Number(row.sellingprice || row.price || 0);
    const cost = Number(row.purchaseprice || row.cost || 0);
    return {
        storeId,
        frameCode: row.framecode || `FC-${Date.now()}`,
        sku,
        brand: row.brand || row.name || '',
        model: row.model || '',
        barcode,
        shape: enumValue(row.shape, FRAME_SHAPES, 'RECTANGLE'),
        color: row.color || null,
        size: row.size || null,
        material: row.material || null,
        gender: row.gender || null,
        purchasePrice: cost,
        sellingPrice: price,
        stockQty: numberOrDefault(row.stockqty || row.stock, 0),
        lowStockAlert: numberOrDefault(row.lowstockalert || row.alert, 5),
    };
}

function buildLensData(row, storeId, barcode, sku) {
    const price = Number(row.sellingprice || row.price || 0);
    const cost = Number(row.purchaseprice || row.cost || 0);

    const lensType = enumValue(row.lenstype || row.type, LENS_TYPES, 'SINGLE_VISION');

    const coating = row.coating
        ? String(row.coating).split(/[|,]/).map(c => c.trim()).filter(Boolean)
        : [];

    return {
        // ✅ FIX: use relation instead of storeId
        store: {
            connect: { id: storeId }
        },

        sku,

        name: row.name || '',
        brand: row.brand || null,

        lensType,
        lensIndex: row.lensindex || row.index || '1.56',
        coating,

        barcode,

        purchasePrice: cost,
        sellingPrice: price,
        stockQty: numberOrDefault(row.stockqty || row.stock, 100),
        lowStockAlert: numberOrDefault(row.lowstockalert, 10),
    };
}

function buildAccessoryData(row, storeId, barcode, sku) {
    const price = Number(row.sellingprice || row.price || 0);
    const cost = Number(row.purchaseprice || row.cost || 0);

    return {
        storeId, // ✅ THIS IS CORRECT

        sku,

        name: row.name || '',
        category: enumValue(row.category, ACCESSORY_CATEGORIES, 'OTHER'),

        barcode,

        purchasePrice: cost,
        sellingPrice: price,
        stockQty: numberOrDefault(row.stockqty || row.stock, 0),
        lowStockAlert: numberOrDefault(row.lowstockalert || row.alert, 5),
    };
}

// ── Preview ───────────────────────────────────────────────────────────────────
exports.previewImport = async (req, res) => {
    try {
        const { type, duplicateMode = "update" } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'File is required' });
        if (!type) return res.status(400).json({ error: 'Type is required' });

        let rows = [];
        if (file.originalname.toLowerCase().endsWith('.csv')) {
            rows = await parseCSV(file.buffer);
        } else {
            rows = parseExcel(file.buffer);
        }

        const preview = rows.slice(0, 50).map((raw, i) => {  // cap preview at 50 rows
            const row = normalizeRow(raw);
            const error = validateRow(type, row);
            return { rowNumber: i + 1, data: row, error: error || null };
        });

        return res.json({
            preview,
            total: rows.length,
            valid: preview.filter(r => !r.error).length,
            invalid: preview.filter(r => r.error).length,
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ── Import ────────────────────────────────────────────────────────────────────
exports.importInventory = async (req, res) => {
    try {
        const { type, duplicateMode = "update" } = req.body;
        const file = req.file;
        const storeId = req.storeId; // FIX: use storeId from auth middleware

        if (!file) return res.status(400).json({ error: 'File is required' });
        if (!type) return res.status(400).json({ error: 'Type is required (frame/lens/accessory)' });
        if (!storeId) return res.status(401).json({ error: 'Unauthorized' });

        const ext = file.originalname.toLowerCase();
        if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx')) {
            return res.status(400).json({ error: 'Only CSV or Excel (.xlsx) files allowed' });
        }

        let rows = [];
        if (ext.endsWith('.csv')) {
            rows = await parseCSV(file.buffer);
        } else {
            rows = parseExcel(file.buffer);
        }

        if (rows.length === 0) {
            return res.status(400).json({ error: 'File is empty or has no data rows' });
        }

        const errors = [];
        let successCount = 0;
        const reservedBarcodes = new Set();
        const reservedSkus = new Set();

        // FIX: process outside transaction to avoid timeout on large files
        // Each row is individually committed so partial imports work
        for (let i = 0; i < rows.length; i++) {
            const row = normalizeRow(rows[i]);
            const error = validateRow(type, row);

            if (error) {
                errors.push({ row: i + 1, error });
                continue;
            }

            try {
                if (type === 'frame') {
                    const normalizedBarcode = cleanBarcode(row.barcode);
                    // FIX: correct model name is prisma.frame (not prisma.frames)
                    const exists = normalizedBarcode
                        ? await prisma.frame.findFirst({
                            where: { barcode: normalizedBarcode, storeId }
                        })
                        : null;

                    if (exists) {

                        // ❌ SKIP
                        if (duplicateMode === "skip") {
                            errors.push({ row: i + 1, error: `Skipped duplicate: ${normalizedBarcode}` });
                            continue;
                        }

                        // 🔄 UPDATE STOCK (MOST IMPORTANT FOR YOU)
                        if (duplicateMode === "update") {
                            const addedQty = Number(row.stockqty || row.stock || 0);

                            const updated = await prisma.frame.update({
                                where: { id: exists.id },
                                data: {
                                    stockQty: exists.stockQty + addedQty
                                }
                            });

                            // Optional but recommended
                            await prisma.stockMovement.create({
                                data: {
                                    storeId,
                                    frameId: exists.id,
                                    type: "IN",
                                    quantity: addedQty,
                                    beforeQty: exists.stockQty,
                                    afterQty: updated.stockQty,
                                    reason: "BULK_IMPORT"
                                }
                            });

                            successCount++;
                            continue;
                        }

                        // 🔁 REPLACE FULL DATA
                        if (duplicateMode === "replace") {
                            const sku = row.sku
                                ? await resolveSku(prisma, 'frame', 'FRM', row.sku, exists.id)
                                : exists.sku;
                            await prisma.frame.update({
                                where: { id: exists.id },
                                data: buildFrameData(row, storeId, normalizedBarcode, sku)
                            });

                            successCount++;
                            continue;
                        }
                    }
                    const barcode = await resolveBarcode(prisma, row.barcode, reservedBarcodes);
                    const sku = await resolveSku(prisma, 'frame', 'FRM', row.sku || undefined, undefined, reservedSkus);
                    const created = await prisma.frame.create({ data: buildFrameData(row, storeId, barcode, sku) });
                    if (created.stockQty > 0) {
                        await prisma.stockMovement.create({
                            data: { storeId, frameId: created.id, type: 'IN', quantity: created.stockQty, beforeQty: 0, afterQty: created.stockQty, reason: 'BULK_IMPORT' }
                        });
                    }
                }

                if (type === 'lens') {
                    // FIX: correct model name is prisma.lens (not prisma.lenses)
                    const normalizedBarcode = cleanBarcode(row.barcode);
                    const exists = normalizedBarcode
                        ? await prisma.lens.findFirst({ where: { barcode: normalizedBarcode, storeId } })
                        : null;
                    if (exists) {
                        if (duplicateMode === 'skip') {
                            errors.push({ row: i + 1, error: `Skipped duplicate: ${normalizedBarcode}` });
                            continue;
                        }
                        if (duplicateMode === 'update') {
                            const addedQty = numberOrDefault(row.stockqty || row.stock, 0);
                            const updated = await prisma.lens.update({
                                where: { id: exists.id },
                                data: { stockQty: exists.stockQty + addedQty }
                            });
                            if (addedQty > 0) {
                                await prisma.stockMovement.create({
                                    data: { storeId, lensId: exists.id, type: 'IN', quantity: addedQty, beforeQty: exists.stockQty, afterQty: updated.stockQty, reason: 'BULK_IMPORT' }
                                });
                            }
                            successCount++;
                            continue;
                        }
                        if (duplicateMode === 'replace') {
                            const sku = row.sku
                                ? await resolveSku(prisma, 'lens', 'LENS', row.sku, exists.id)
                                : exists.sku;
                            await prisma.lens.update({
                                where: { id: exists.id },
                                data: buildLensData(row, storeId, normalizedBarcode, sku)
                            });
                            successCount++;
                            continue;
                        }
                    }
                    const barcode = await resolveBarcode(prisma, row.barcode, reservedBarcodes);
                    const sku = await resolveSku(prisma, 'lens', 'LENS', row.sku || undefined, undefined, reservedSkus);
                    const created = await prisma.lens.create({ data: buildLensData(row, storeId, barcode, sku) });
                    if (created.stockQty > 0) {
                        await prisma.stockMovement.create({
                            data: { storeId, lensId: created.id, type: 'IN', quantity: created.stockQty, beforeQty: 0, afterQty: created.stockQty, reason: 'BULK_IMPORT' }
                        });
                    }
                }

                if (type === 'accessory') {
                    // FIX: correct model name is prisma.accessory (not prisma.accessories)
                    const normalizedBarcode = cleanBarcode(row.barcode);
                    const exists = normalizedBarcode
                        ? await prisma.accessory.findFirst({ where: { barcode: normalizedBarcode, storeId } })
                        : null;
                    if (exists) {
                        if (duplicateMode === 'skip') {
                            errors.push({ row: i + 1, error: `Skipped duplicate: ${normalizedBarcode}` });
                            continue;
                        }
                        if (duplicateMode === 'update') {
                            const addedQty = numberOrDefault(row.stockqty || row.stock, 0);
                            const updated = await prisma.accessory.update({
                                where: { id: exists.id },
                                data: { stockQty: exists.stockQty + addedQty }
                            });
                            if (addedQty > 0) {
                                await prisma.stockMovement.create({
                                    data: { storeId, accessoryId: exists.id, type: 'IN', quantity: addedQty, beforeQty: exists.stockQty, afterQty: updated.stockQty, reason: 'BULK_IMPORT' }
                                });
                            }
                            successCount++;
                            continue;
                        }
                        if (duplicateMode === 'replace') {
                            const sku = row.sku
                                ? await resolveSku(prisma, 'accessory', 'ACC', row.sku, exists.id)
                                : exists.sku;
                            await prisma.accessory.update({
                                where: { id: exists.id },
                                data: buildAccessoryData(row, storeId, normalizedBarcode, sku)
                            });
                            successCount++;
                            continue;
                        }
                    }
                    const barcode = await resolveBarcode(prisma, row.barcode, reservedBarcodes);
                    const sku = await resolveSku(prisma, 'accessory', 'ACC', row.sku || undefined, undefined, reservedSkus);
                    const created = await prisma.accessory.create({ data: buildAccessoryData(row, storeId, barcode, sku) });
                    if (created.stockQty > 0) {
                        await prisma.stockMovement.create({
                            data: { storeId, accessoryId: created.id, type: 'IN', quantity: created.stockQty, beforeQty: 0, afterQty: created.stockQty, reason: 'BULK_IMPORT' }
                        });
                    }
                }

                successCount++;
            } catch (err) {
                errors.push({ row: i + 1, error: err.message });
            }
        }

        return res.json({
            success: true,
            total: rows.length,
            imported: successCount,
            failed: errors.length,
            errors: errors.slice(0, 50), // cap error list for response size
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
