-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "address" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "creditLimit" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "note" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "paymentTermsDays" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "taxId" TEXT;

-- CreateIndex
CREATE INDEX "Supplier_taxId_idx" ON "Supplier"("taxId");
