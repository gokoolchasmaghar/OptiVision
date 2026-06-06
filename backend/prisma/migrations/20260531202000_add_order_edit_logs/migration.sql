-- CreateTable
CREATE TABLE "order_edit_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_edit_logs_orderId_idx" ON "order_edit_logs"("orderId");

-- CreateIndex
CREATE INDEX "order_edit_logs_userId_idx" ON "order_edit_logs"("userId");

-- CreateIndex
CREATE INDEX "order_edit_logs_createdAt_idx" ON "order_edit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "order_edit_logs" ADD CONSTRAINT "order_edit_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_edit_logs" ADD CONSTRAINT "order_edit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
