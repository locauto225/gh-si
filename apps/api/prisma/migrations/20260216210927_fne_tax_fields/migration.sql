-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "taxCode" TEXT;
ALTER TABLE "InvoiceLine" ADD COLUMN "taxRate" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "description" TEXT;
ALTER TABLE "Product" ADD COLUMN "taxCode" TEXT;
ALTER TABLE "Product" ADD COLUMN "taxRate" INTEGER;

-- CreateIndex
CREATE INDEX "Product_taxCode_idx" ON "Product"("taxCode");
