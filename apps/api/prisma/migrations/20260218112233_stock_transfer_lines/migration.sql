/*
  Warnings:

  - You are about to drop the column `productId` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `qty` on the `StockTransfer` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockTransfer" ("createdAt", "fromWarehouseId", "id", "note", "status", "toWarehouseId", "updatedAt") SELECT "createdAt", "fromWarehouseId", "id", "note", "status", "toWarehouseId", "updatedAt" FROM "StockTransfer";
DROP TABLE "StockTransfer";
ALTER TABLE "new_StockTransfer" RENAME TO "StockTransfer";
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");
CREATE INDEX "StockTransfer_createdAt_idx" ON "StockTransfer"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferLine_productId_idx" ON "StockTransferLine"("productId");

-- CreateIndex
CREATE INDEX "StockTransferLine_createdAt_idx" ON "StockTransferLine"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferLine_transferId_productId_key" ON "StockTransferLine"("transferId", "productId");
