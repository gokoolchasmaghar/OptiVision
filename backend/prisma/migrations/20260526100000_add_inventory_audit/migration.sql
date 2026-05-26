-- CreateEnum
CREATE TYPE "InventoryAuditStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable "inventory_audits"
CREATE TABLE "inventory_audits" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable "inventory_audit_items"
CREATE TABLE "inventory_audit_items" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemBarcode" TEXT,
    "oldQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_audits_storeId_idx" ON "inventory_audits"("storeId");
CREATE INDEX "inventory_audits_userId_idx" ON "inventory_audits"("userId");
CREATE INDEX "inventory_audits_status_idx" ON "inventory_audits"("status");

-- CreateIndex
CREATE INDEX "inventory_audit_items_auditId_idx" ON "inventory_audit_items"("auditId");
CREATE INDEX "inventory_audit_items_itemId_idx" ON "inventory_audit_items"("itemId");

-- AddForeignKey
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_items" ADD CONSTRAINT "inventory_audit_items_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "inventory_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
