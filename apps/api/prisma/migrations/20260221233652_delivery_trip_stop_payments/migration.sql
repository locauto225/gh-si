-- CreateTable
CREATE TABLE "DeliveryTrip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fromWarehouseId" TEXT NOT NULL,
    "driverId" TEXT,
    "note" TEXT,
    "startedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryTrip_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clientId" TEXT,
    "storeId" TEXT,
    "addressSnapshot" TEXT,
    "phoneSnapshot" TEXT,
    "contactNameSnapshot" TEXT,
    "note" TEXT,
    "visitedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DeliveryTrip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryStop_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryStop_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StopSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StopSale_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "DeliveryStop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StopSale_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StopPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stopId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StopPayment_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "DeliveryStop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    CONSTRAINT "Delivery_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "DeliveryTrip" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "DeliveryStop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE INDEX "Delivery_tripId_idx" ON "Delivery"("tripId");
CREATE INDEX "Delivery_stopId_idx" ON "Delivery"("stopId");
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");
CREATE INDEX "Delivery_trackingToken_idx" ON "Delivery"("trackingToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTrip_number_key" ON "DeliveryTrip"("number");

-- CreateIndex
CREATE INDEX "DeliveryTrip_status_idx" ON "DeliveryTrip"("status");

-- CreateIndex
CREATE INDEX "DeliveryTrip_fromWarehouseId_idx" ON "DeliveryTrip"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "DeliveryTrip_driverId_idx" ON "DeliveryTrip"("driverId");

-- CreateIndex
CREATE INDEX "DeliveryTrip_startedAt_idx" ON "DeliveryTrip"("startedAt");

-- CreateIndex
CREATE INDEX "DeliveryTrip_closedAt_idx" ON "DeliveryTrip"("closedAt");

-- CreateIndex
CREATE INDEX "DeliveryTrip_createdAt_idx" ON "DeliveryTrip"("createdAt");

-- CreateIndex
CREATE INDEX "DeliveryStop_tripId_idx" ON "DeliveryStop"("tripId");

-- CreateIndex
CREATE INDEX "DeliveryStop_status_idx" ON "DeliveryStop"("status");

-- CreateIndex
CREATE INDEX "DeliveryStop_clientId_idx" ON "DeliveryStop"("clientId");

-- CreateIndex
CREATE INDEX "DeliveryStop_storeId_idx" ON "DeliveryStop"("storeId");

-- CreateIndex
CREATE INDEX "DeliveryStop_visitedAt_idx" ON "DeliveryStop"("visitedAt");

-- CreateIndex
CREATE INDEX "DeliveryStop_createdAt_idx" ON "DeliveryStop"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStop_tripId_sequence_key" ON "DeliveryStop"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "StopSale_stopId_idx" ON "StopSale"("stopId");

-- CreateIndex
CREATE INDEX "StopSale_saleId_idx" ON "StopSale"("saleId");

-- CreateIndex
CREATE INDEX "StopSale_createdAt_idx" ON "StopSale"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StopSale_stopId_saleId_key" ON "StopSale"("stopId", "saleId");

-- CreateIndex
CREATE INDEX "StopPayment_stopId_idx" ON "StopPayment"("stopId");

-- CreateIndex
CREATE INDEX "StopPayment_method_idx" ON "StopPayment"("method");

-- CreateIndex
CREATE INDEX "StopPayment_receivedAt_idx" ON "StopPayment"("receivedAt");

-- CreateIndex
CREATE INDEX "StopPayment_createdAt_idx" ON "StopPayment"("createdAt");
