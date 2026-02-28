-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "price" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "brand" TEXT,
    "barcode" TEXT,
    "packSize" INTEGER,
    "description" TEXT,
    "taxCode" TEXT,
    "taxRate" INTEGER,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "brand", "categoryId", "createdAt", "deletedAt", "description", "id", "isActive", "name", "packSize", "price", "sku", "taxCode", "taxRate", "unit", "updatedAt") SELECT "barcode", "brand", "categoryId", "createdAt", "deletedAt", "description", "id", "isActive", "name", "packSize", "price", "sku", "taxCode", "taxRate", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
CREATE INDEX "Product_isActive_deletedAt_idx" ON "Product"("isActive", "deletedAt");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_nameSearch_idx" ON "Product"("nameSearch");
CREATE INDEX "Product_taxCode_idx" ON "Product"("taxCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
