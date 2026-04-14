/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `accessories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku]` on the table `frames` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku]` on the table `lenses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sku` to the `accessories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `frames` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `lenses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accessories" ADD COLUMN     "modelCode" TEXT,
ADD COLUMN     "sku" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "frames" ADD COLUMN     "modelCode" TEXT,
ADD COLUMN     "sku" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "lenses" ADD COLUMN     "modelCode" TEXT,
ADD COLUMN     "sku" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accessories_sku_key" ON "accessories"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "frames_sku_key" ON "frames"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "lenses_sku_key" ON "lenses"("sku");
