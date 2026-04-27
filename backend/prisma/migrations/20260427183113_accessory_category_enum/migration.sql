/*
  Warnings:

  - The `category` column on the `accessories` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AccessoryCategory" AS ENUM ('SUNGLASSES', 'CASE', 'SOLUTION', 'CLOTH', 'OTHER');

-- AlterTable
ALTER TABLE "accessories" DROP COLUMN "category",
ADD COLUMN     "category" "AccessoryCategory" NOT NULL DEFAULT 'OTHER';
