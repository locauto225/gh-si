-- CreateTable
CREATE TABLE "FneEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT,
    "saleId" TEXT,
    "status" TEXT NOT NULL,
    "payloadHash" TEXT,
    "request" TEXT,
    "response" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FneEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FneEvent_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FneEvent_invoiceId_idx" ON "FneEvent"("invoiceId");

-- CreateIndex
CREATE INDEX "FneEvent_saleId_idx" ON "FneEvent"("saleId");

-- CreateIndex
CREATE INDEX "FneEvent_status_idx" ON "FneEvent"("status");

-- CreateIndex
CREATE INDEX "FneEvent_createdAt_idx" ON "FneEvent"("createdAt");
