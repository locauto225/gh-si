-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "warehouseId" TEXT NOT NULL,
    "clientId" TEXT,
    "fulfillment" TEXT NOT NULL DEFAULT 'PICKUP',
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "totalHT" INTEGER NOT NULL DEFAULT 0,
    "totalTTC" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" DATETIME,
    "preparedAt" DATETIME,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "invoiceId" TEXT,
    CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "qtyPrepared" INTEGER NOT NULL DEFAULT 0,
    "qtyDelivered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "tripId" TEXT,
    "stopId" TEXT,
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
    "orderId" TEXT,
    CONSTRAINT "Delivery_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DeliveryTrip" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "DeliveryStop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("createdAt", "deliveredAt", "dispatchedAt", "driverId", "id", "note", "number", "preparedAt", "proofNote", "receiverName", "receiverPhone", "saleId", "status", "stopId", "trackingToken", "transferId", "tripId", "updatedAt", "warehouseId") SELECT "createdAt", "deliveredAt", "dispatchedAt", "driverId", "id", "note", "number", "preparedAt", "proofNote", "receiverName", "receiverPhone", "saleId", "status", "stopId", "trackingToken", "transferId", "tripId", "updatedAt", "warehouseId" FROM "Delivery";
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
CREATE INDEX "Delivery_tripId_idx" ON "Delivery"("tripId");
CREATE INDEX "Delivery_stopId_idx" ON "Delivery"("stopId");
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");
CREATE INDEX "Delivery_trackingToken_idx" ON "Delivery"("trackingToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_fulfillment_idx" ON "Order"("fulfillment");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_productId_idx" ON "OrderLine"("productId");

-- CreateIndex
CREATE INDEX "OrderLine_createdAt_idx" ON "OrderLine"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_orderId_productId_key" ON "OrderLine"("orderId", "productId");
