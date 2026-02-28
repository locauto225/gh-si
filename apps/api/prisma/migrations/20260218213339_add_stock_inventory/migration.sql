-- CreateTable
CREATE TABLE "StockInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL DEFAULT 'FULL',
    "warehouseId" TEXT NOT NULL,
    "categoryId" TEXT,
    "note" TEXT,
    "postedAt" DATETIME,
    "postedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockInventory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockInventoryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL DEFAULT 0,
    "countedQty" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockInventoryLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "StockInventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockInventoryLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StockInventory_number_key" ON "StockInventory"("number");

-- CreateIndex
CREATE INDEX "StockInventory_status_idx" ON "StockInventory"("status");

-- CreateIndex
CREATE INDEX "StockInventory_mode_idx" ON "StockInventory"("mode");

-- CreateIndex
CREATE INDEX "StockInventory_warehouseId_idx" ON "StockInventory"("warehouseId");

-- CreateIndex
CREATE INDEX "StockInventory_categoryId_idx" ON "StockInventory"("categoryId");

-- CreateIndex
CREATE INDEX "StockInventory_createdAt_idx" ON "StockInventory"("createdAt");

-- CreateIndex
CREATE INDEX "StockInventoryLine_inventoryId_idx" ON "StockInventoryLine"("inventoryId");

-- CreateIndex
CREATE INDEX "StockInventoryLine_productId_idx" ON "StockInventoryLine"("productId");

-- CreateIndex
CREATE INDEX "StockInventoryLine_createdAt_idx" ON "StockInventoryLine"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockInventoryLine_inventoryId_productId_key" ON "StockInventoryLine"("inventoryId", "productId");
