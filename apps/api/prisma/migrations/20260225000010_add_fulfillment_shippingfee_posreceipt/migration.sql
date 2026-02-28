-- CreateTable
CREATE TABLE "PosReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "totalTTC" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PosReceipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PosReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT NOT NULL DEFAULT 'DEPOT',
    "fulfillment" TEXT NOT NULL DEFAULT 'PICKUP',
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "clientId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "storeId" TEXT,
    "note" TEXT,
    "totalHT" INTEGER NOT NULL DEFAULT 0,
    "totalTTC" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "postedAt" DATETIME,
    "fneStatus" TEXT,
    "fneRef" TEXT,
    "fneSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("amountPaid", "channel", "clientId", "createdAt", "fneRef", "fneSentAt", "fneStatus", "id", "note", "number", "paymentStatus", "postedAt", "status", "storeId", "totalHT", "totalTTC", "updatedAt", "warehouseId") SELECT "amountPaid", "channel", "clientId", "createdAt", "fneRef", "fneSentAt", "fneStatus", "id", "note", "number", "paymentStatus", "postedAt", "status", "storeId", "totalHT", "totalTTC", "updatedAt", "warehouseId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_channel_idx" ON "Sale"("channel");
CREATE INDEX "Sale_fulfillment_idx" ON "Sale"("fulfillment");
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX "Sale_warehouseId_idx" ON "Sale"("warehouseId");
CREATE INDEX "Sale_storeId_idx" ON "Sale"("storeId");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PosReceipt_number_key" ON "PosReceipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PosReceipt_saleId_key" ON "PosReceipt"("saleId");

-- CreateIndex
CREATE INDEX "PosReceipt_storeId_idx" ON "PosReceipt"("storeId");

-- CreateIndex
CREATE INDEX "PosReceipt_createdAt_idx" ON "PosReceipt"("createdAt");
