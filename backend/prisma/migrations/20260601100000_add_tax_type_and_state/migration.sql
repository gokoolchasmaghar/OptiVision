-- Add TaxType enum
CREATE TYPE "TaxType" AS ENUM ('CGST_SGST', 'IGST');

-- Add state field to stores
ALTER TABLE stores ADD COLUMN state VARCHAR(255);

-- Add state field to customers
ALTER TABLE customers ADD COLUMN state VARCHAR(255);

-- Add tax type and split fields to order_items
ALTER TABLE order_items ADD COLUMN "taxType" "TaxType" NOT NULL DEFAULT 'CGST_SGST';
ALTER TABLE order_items ADD COLUMN "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add tax type and split fields to orders
ALTER TABLE orders ADD COLUMN "taxType" "TaxType" NOT NULL DEFAULT 'CGST_SGST';
ALTER TABLE orders ADD COLUMN "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
