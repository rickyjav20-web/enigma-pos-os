-- AlterTable: Add kdsStation to Product
ALTER TABLE "Product" ADD COLUMN "kdsStation" TEXT;

-- AlterTable: Add kdsStation to SalesItem
ALTER TABLE "SalesItem" ADD COLUMN "kdsStation" TEXT;
