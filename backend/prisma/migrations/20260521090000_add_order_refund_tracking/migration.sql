-- Add refund tracking for cancelled orders.
ALTER TABLE "orders"
ADD COLUMN "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundedById" TEXT,
ADD COLUMN "refundNote" TEXT;

CREATE INDEX "orders_refundedById_idx" ON "orders"("refundedById");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_refundedById_fkey"
FOREIGN KEY ("refundedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
