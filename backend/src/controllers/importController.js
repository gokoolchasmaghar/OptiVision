const prisma = require('../utils/prisma');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { Readable } = require('stream');

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCSV(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        Readable.from(buffer.toString())
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
        if (!row.barcode) return 'Barcode is required for frames';
        if (!row.model) return 'Model is required';
        if (!row.stockqty) return 'Stock quantity is required';
    }

    if (type === 'lens') {
        if (!row.lenstype && !row.type) {
            return 'Lens type is required';
        }
    }

    return null;
}

// ── Build Prisma data objects ─────────────────────────────────────────────────
function buildFrameData(row, storeId) {
    const price = Number(row.sellingprice || row.price || 0);
    const cost = Number(row.purchaseprice || row.cost || 0);
    return {
        storeId,
        frameCode: row.framecode || `FC-${Date.now()}`,
        sku: row.sku || `SKU-${Date.now()}`,
        brand: row.brand || row.name || '',
        model: row.model || '',
        barcode: row.barcode?.toString().trim(),
        shape: row.shape?.toUpperCase() || 'RECTANGLE',
        color: row.color || null,
        size: row.size || null,
        material: row.material || null,
        gender: row.gender || null,
        purchasePrice: cost,
        sellingPrice: price,
        stockQty: Number(row.stockqty || row.stock || 0),
        lowStockAlert: Number(row.lowstockalert || row.alert || 5),
    };
}

function buildLensData(row, storeId) {
    const price = Number(row.sellingprice || row.price || 0);
    const cost = Number(row.purchaseprice || row.cost || 0);

    const lensType = (row.lenstype || row.type || 'SINGLE_VISION').toUpperCase();

    const coating = row.coating
        ? row.coating.split(',').map(c => c.trim()).filter(Boolean)
        : [];

    return {
        // ✅ FIX: use relation instead of storeId
        store: {
            connect: { id: storeId }
        },

        sku: row.sku || `SKU-LENS-${Date.now()}`,

        name: row.name || '',
        brand: row.brand || null,

        lensType,
        lensIndex: row.lensindex || row.index || '1.56',
        coating,

        barcode: row.barcode?.toString().trim() || `LENS-${row.name?.replace(/\s+/g, '').toUpperCase()}-${Date.now()}`,

        purchasePrice: cost,
        sellingPrice: price,
        stockQty: Number(row.stockqty || row.stock || 100),
        lowStockAlert: Number(row.lowstockalert || 10),
    };
}

function buildAccessoryData(row, storeId) {
    const price = Number(row.sellingprice || row.price || 0);
    const cost = Number(row.purchaseprice || row.cost || 0);

    return {
        storeId, // ✅ THIS IS CORRECT

        sku: row.sku || `SKU-ACC-${Date.now()}`,

        name: row.name || '',
        category: row.category || 'GENERAL',

        barcode: row.barcode?.toString().trim() || `ACC-${Date.now()}`,

        purchasePrice: cost,
        sellingPrice: price,
        stockQty: Number(row.stockqty || row.stock || 0),
        lowStockAlert: Number(row.lowstockalert || row.alert || 5),
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
                    // FIX: correct model name is prisma.frame (not prisma.frames)
                    const exists = await prisma.frame.findFirst({
                        where: { barcode: row.barcode, storeId }
                    });

                    if (exists) {

                        // ❌ SKIP
                        if (duplicateMode === "skip") {
                            errors.push({ row: i + 1, error: `Skipped duplicate: ${row.barcode}` });
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
                            await prisma.frame.update({
                                where: { id: exists.id },
                                data: buildFrameData(row, storeId)
                            });

                            successCount++;
                            continue;
                        }
                    }
                    await prisma.frame.create({ data: buildFrameData(row, storeId) });
                }

                if (type === 'lens') {
                    // FIX: correct model name is prisma.lens (not prisma.lenses)
                    await prisma.lens.create({ data: buildLensData(row, storeId) });
                }

                if (type === 'accessory') {
                    // FIX: correct model name is prisma.accessory (not prisma.accessories)
                    await prisma.accessory.create({ data: buildAccessoryData(row, storeId) });
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