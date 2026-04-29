/*
  Warnings:

  - Made the column `sku` on table `accessories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sku` on table `frames` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sku` on table `lenses` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "accessories" ALTER COLUMN "sku" SET NOT NULL;

-- AlterTable
ALTER TABLE "frames" ALTER COLUMN "sku" SET NOT NULL;

-- AlterTable
ALTER TABLE "lenses" ALTER COLUMN "sku" SET NOT NULL;
