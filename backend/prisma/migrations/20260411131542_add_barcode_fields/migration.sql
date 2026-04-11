/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `accessories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode]` on the table `frames` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode]` on the table `lenses` will be added. If there are existing duplicate values, this will fail.
  - Made the column `barcode` on table `accessories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `barcode` on table `frames` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `barcode` to the `lenses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accessories" ALTER COLUMN "barcode" SET NOT NULL;

-- AlterTable
ALTER TABLE "frames" ALTER COLUMN "barcode" SET NOT NULL;

-- AlterTable
ALTER TABLE "lenses" ADD COLUMN     "barcode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "stores" ALTER COLUMN "gstEnabled" SET DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "accessories_barcode_key" ON "accessories"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "frames_barcode_key" ON "frames"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "lenses_barcode_key" ON "lenses"("barcode");
