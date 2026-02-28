-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT NOT NULL DEFAULT 'DEPOT',
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
INSERT INTO "new_Sale" ("amountPaid", "clientId", "createdAt", "fneRef", "fneSentAt", "fneStatus", "id", "note", "number", "paymentStatus", "postedAt", "status", "storeId", "totalHT", "totalTTC", "updatedAt", "warehouseId") SELECT "amountPaid", "clientId", "createdAt", "fneRef", "fneSentAt", "fneStatus", "id", "note", "number", "paymentStatus", "postedAt", "status", "storeId", "totalHT", "totalTTC", "updatedAt", "warehouseId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_channel_idx" ON "Sale"("channel");
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX "Sale_warehouseId_idx" ON "Sale"("warehouseId");
CREATE INDEX "Sale_storeId_idx" ON "Sale"("storeId");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "warehouseId" TEXT NOT NULL,
    "priceListId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Store_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Store_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("address", "code", "createdAt", "deletedAt", "id", "isActive", "name", "updatedAt", "warehouseId") SELECT "address", "code", "createdAt", "deletedAt", "id", "isActive", "name", "updatedAt", "warehouseId" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");
CREATE UNIQUE INDEX "Store_warehouseId_key" ON "Store"("warehouseId");
CREATE INDEX "Store_isActive_idx" ON "Store"("isActive");
CREATE INDEX "Store_deletedAt_idx" ON "Store"("deletedAt");
CREATE INDEX "Store_isActive_deletedAt_idx" ON "Store"("isActive", "deletedAt");
CREATE INDEX "Store_name_idx" ON "Store"("name");
CREATE INDEX "Store_code_idx" ON "Store"("code");
CREATE INDEX "Store_warehouseId_idx" ON "Store"("warehouseId");
CREATE INDEX "Store_priceListId_idx" ON "Store"("priceListId");
CREATE TABLE "new_Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'DEPOT',
    "priceListId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Warehouse_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Warehouse" ("address", "code", "createdAt", "deletedAt", "id", "isActive", "kind", "name", "updatedAt") SELECT "address", "code", "createdAt", "deletedAt", "id", "isActive", "kind", "name", "updatedAt" FROM "Warehouse";
DROP TABLE "Warehouse";
ALTER TABLE "new_Warehouse" RENAME TO "Warehouse";
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_kind_idx" ON "Warehouse"("kind");
CREATE INDEX "Warehouse_priceListId_idx" ON "Warehouse"("priceListId");
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");
CREATE INDEX "Warehouse_deletedAt_idx" ON "Warehouse"("deletedAt");
CREATE INDEX "Warehouse_isActive_deletedAt_idx" ON "Warehouse"("isActive", "deletedAt");
CREATE INDEX "Warehouse_isActive_deletedAt_kind_idx" ON "Warehouse"("isActive", "deletedAt", "kind");
CREATE INDEX "Warehouse_code_idx" ON "Warehouse"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_code_key" ON "PriceList"("code");

-- CreateIndex
CREATE INDEX "PriceList_isActive_idx" ON "PriceList"("isActive");

-- CreateIndex
CREATE INDEX "PriceList_deletedAt_idx" ON "PriceList"("deletedAt");

-- CreateIndex
CREATE INDEX "PriceList_isActive_deletedAt_idx" ON "PriceList"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "PriceList_code_idx" ON "PriceList"("code");

-- CreateIndex
CREATE INDEX "PriceList_name_idx" ON "PriceList"("name");

-- CreateIndex
CREATE INDEX "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");

-- CreateIndex
CREATE INDEX "PriceListItem_productId_idx" ON "PriceListItem"("productId");

-- CreateIndex
CREATE INDEX "PriceListItem_createdAt_idx" ON "PriceListItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productId_key" ON "PriceListItem"("priceListId", "productId");
