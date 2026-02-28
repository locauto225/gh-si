-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "receivedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_receivedAt_idx" ON "Payment"("receivedAt");

-- CreateIndex
CREATE INDEX "Payment_method_receivedAt_idx" ON "Payment"("method", "receivedAt");
