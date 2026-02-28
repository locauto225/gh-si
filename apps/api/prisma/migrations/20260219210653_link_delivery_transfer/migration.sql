-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "saleId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "transferId" TEXT,
    "driverId" TEXT,
    "note" TEXT,
    "preparedAt" DATETIME,
    "dispatchedAt" DATETIME,
    "deliveredAt" DATETIME,
    "receiverName" TEXT,
    "receiverPhone" TEXT,
    "proofNote" TEXT,
    "trackingToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("createdAt", "deliveredAt", "dispatchedAt", "driverId", "id", "note", "number", "preparedAt", "proofNote", "receiverName", "receiverPhone", "saleId", "status", "trackingToken", "updatedAt", "warehouseId") SELECT "createdAt", "deliveredAt", "dispatchedAt", "driverId", "id", "note", "number", "preparedAt", "proofNote", "receiverName", "receiverPhone", "saleId", "status", "trackingToken", "updatedAt", "warehouseId" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE UNIQUE INDEX "Delivery_number_key" ON "Delivery"("number");
CREATE UNIQUE INDEX "Delivery_transferId_key" ON "Delivery"("transferId");
CREATE UNIQUE INDEX "Delivery_trackingToken_key" ON "Delivery"("trackingToken");
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
CREATE INDEX "Delivery_saleId_idx" ON "Delivery"("saleId");
CREATE INDEX "Delivery_warehouseId_idx" ON "Delivery"("warehouseId");
CREATE INDEX "Delivery_transferId_idx" ON "Delivery"("transferId");
CREATE INDEX "Delivery_driverId_idx" ON "Delivery"("driverId");
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");
CREATE INDEX "Delivery_trackingToken_idx" ON "Delivery"("trackingToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
