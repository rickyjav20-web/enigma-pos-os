-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN     "registeredById" TEXT;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
