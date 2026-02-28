-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "shippedAt" DATETIME,
    "shippedBy" TEXT,
    "receivedAt" DATETIME,
    "receivedBy" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockTransfer" ("createdAt", "fromWarehouseId", "id", "note", "status", "toWarehouseId", "updatedAt") SELECT "createdAt", "fromWarehouseId", "id", "note", "status", "toWarehouseId", "updatedAt" FROM "StockTransfer";
DROP TABLE "StockTransfer";
ALTER TABLE "new_StockTransfer" RENAME TO "StockTransfer";
CREATE UNIQUE INDEX "StockTransfer_number_key" ON "StockTransfer"("number");
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");
CREATE INDEX "StockTransfer_shippedAt_idx" ON "StockTransfer"("shippedAt");
CREATE INDEX "StockTransfer_receivedAt_idx" ON "StockTransfer"("receivedAt");
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");
CREATE TABLE "new_StockTransferLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockTransferLine" ("createdAt", "id", "note", "productId", "qty", "transferId", "updatedAt") SELECT "createdAt", "id", "note", "productId", "qty", "transferId", "updatedAt" FROM "StockTransferLine";
DROP TABLE "StockTransferLine";
ALTER TABLE "new_StockTransferLine" RENAME TO "StockTransferLine";
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");
CREATE INDEX "StockTransferLine_productId_idx" ON "StockTransferLine"("productId");
CREATE INDEX "StockTransferLine_createdAt_idx" ON "StockTransferLine"("createdAt");
CREATE UNIQUE INDEX "StockTransferLine_transferId_productId_key" ON "StockTransferLine"("transferId", "productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
