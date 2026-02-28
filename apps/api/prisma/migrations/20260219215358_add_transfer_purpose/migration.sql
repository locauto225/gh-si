-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT NOT NULL DEFAULT 'STORE_REPLENISH',
    "journeyId" TEXT,
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
INSERT INTO "new_StockTransfer" ("createdAt", "fromWarehouseId", "id", "note", "number", "receivedAt", "receivedBy", "shippedAt", "shippedBy", "status", "toWarehouseId", "updatedAt") SELECT "createdAt", "fromWarehouseId", "id", "note", "number", "receivedAt", "receivedBy", "shippedAt", "shippedBy", "status", "toWarehouseId", "updatedAt" FROM "StockTransfer";
DROP TABLE "StockTransfer";
ALTER TABLE "new_StockTransfer" RENAME TO "StockTransfer";
CREATE UNIQUE INDEX "StockTransfer_number_key" ON "StockTransfer"("number");
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");
CREATE INDEX "StockTransfer_purpose_idx" ON "StockTransfer"("purpose");
CREATE INDEX "StockTransfer_journeyId_idx" ON "StockTransfer"("journeyId");
CREATE INDEX "StockTransfer_shippedAt_idx" ON "StockTransfer"("shippedAt");
CREATE INDEX "StockTransfer_receivedAt_idx" ON "StockTransfer"("receivedAt");
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
