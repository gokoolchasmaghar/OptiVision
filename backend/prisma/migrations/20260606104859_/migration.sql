-- AlterTable
ALTER TABLE "accessories" ALTER COLUMN "gstRate" SET DEFAULT 18;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "state" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "stores" ALTER COLUMN "state" SET DATA TYPE TEXT;
