-- CreateTable
CREATE TABLE "DeliveryLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryLineItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "saleId" TEXT,
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
    CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("createdAt", "deliveredAt", "dispatchedAt", "driverId", "id", "note", "number", "preparedAt", "proofNote", "receiverName", "receiverPhone", "saleId", "status", "trackingToken", "transferId", "updatedAt", "warehouseId") SELECT "createdAt", "deliveredAt", "dispatchedAt", "driverId", "id", "note", "number", "preparedAt", "proofNote", "receiverName", "receiverPhone", "saleId", "status", "trackingToken", "transferId", "updatedAt", "warehouseId" FROM "Delivery";
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

-- CreateIndex
CREATE INDEX "DeliveryLineItem_deliveryId_idx" ON "DeliveryLineItem"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryLineItem_productId_idx" ON "DeliveryLineItem"("productId");

-- CreateIndex
CREATE INDEX "DeliveryLineItem_createdAt_idx" ON "DeliveryLineItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryLineItem_deliveryId_productId_key" ON "DeliveryLineItem"("deliveryId", "productId");
