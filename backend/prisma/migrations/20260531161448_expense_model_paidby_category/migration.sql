-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "customCategoryName" TEXT,
ADD COLUMN     "paidBy" TEXT;

-- AlterTable
ALTER TABLE "inventory_audits" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionNote" TEXT;

-- AddForeignKey
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
