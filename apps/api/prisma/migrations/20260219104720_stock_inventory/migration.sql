-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockInventoryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL DEFAULT 0,
    "countedQty" INTEGER,
    "delta" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockInventoryLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "StockInventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockInventoryLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockInventoryLine" ("countedQty", "createdAt", "expectedQty", "id", "inventoryId", "note", "productId", "status", "updatedAt") SELECT "countedQty", "createdAt", "expectedQty", "id", "inventoryId", "note", "productId", "status", "updatedAt" FROM "StockInventoryLine";
DROP TABLE "StockInventoryLine";
ALTER TABLE "new_StockInventoryLine" RENAME TO "StockInventoryLine";
CREATE INDEX "StockInventoryLine_inventoryId_idx" ON "StockInventoryLine"("inventoryId");
CREATE INDEX "StockInventoryLine_productId_idx" ON "StockInventoryLine"("productId");
CREATE INDEX "StockInventoryLine_createdAt_idx" ON "StockInventoryLine"("createdAt");
CREATE INDEX "StockInventoryLine_status_idx" ON "StockInventoryLine"("status");
CREATE UNIQUE INDEX "StockInventoryLine_inventoryId_productId_key" ON "StockInventoryLine"("inventoryId", "productId");
CREATE TABLE "new_StockMove" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "transferId" TEXT,
    "inventoryId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMove_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMove_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "StockInventory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMove_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMove_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockMove" ("createdAt", "id", "kind", "note", "productId", "qtyDelta", "refId", "refType", "transferId", "warehouseId") SELECT "createdAt", "id", "kind", "note", "productId", "qtyDelta", "refId", "refType", "transferId", "warehouseId" FROM "StockMove";
DROP TABLE "StockMove";
ALTER TABLE "new_StockMove" RENAME TO "StockMove";
CREATE INDEX "StockMove_warehouseId_idx" ON "StockMove"("warehouseId");
CREATE INDEX "StockMove_productId_idx" ON "StockMove"("productId");
CREATE INDEX "StockMove_warehouseId_productId_idx" ON "StockMove"("warehouseId", "productId");
CREATE INDEX "StockMove_createdAt_idx" ON "StockMove"("createdAt");
CREATE INDEX "StockMove_inventoryId_idx" ON "StockMove"("inventoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
