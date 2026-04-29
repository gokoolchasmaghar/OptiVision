-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "invoiceYear" INTEGER,
ALTER COLUMN "invoicePrefix" SET DEFAULT 'INVGC',
ALTER COLUMN "invoiceCounter" SET DEFAULT 1;
