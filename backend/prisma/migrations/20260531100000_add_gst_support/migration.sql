-- AlterTable: Add GST fields to frames
ALTER TABLE "frames" ADD COLUMN "hsn" TEXT NOT NULL DEFAULT '9003',
ADD COLUMN "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN "rateInclusiveOfGst" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add GST fields to lenses
ALTER TABLE "lenses" ADD COLUMN "hsn" TEXT NOT NULL DEFAULT '9001',
ADD COLUMN "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN "rateInclusiveOfGst" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add GST fields to accessories
ALTER TABLE "accessories" ADD COLUMN "hsn" TEXT NOT NULL DEFAULT '9004',
ADD COLUMN "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN "rateInclusiveOfGst" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add GST fields to order_items
ALTER TABLE "order_items" ADD COLUMN "hsn" TEXT,
ADD COLUMN "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN "taxableValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "rateInclusiveOfGst" BOOLEAN NOT NULL DEFAULT false;

-- Add CASCADE delete for order_items
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_orderId_fkey",
ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
