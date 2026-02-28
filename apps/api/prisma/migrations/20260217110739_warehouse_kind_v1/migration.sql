-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'DEPOT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Warehouse" ("address", "code", "createdAt", "deletedAt", "id", "isActive", "name", "updatedAt") SELECT "address", "code", "createdAt", "deletedAt", "id", "isActive", "name", "updatedAt" FROM "Warehouse";
DROP TABLE "Warehouse";
ALTER TABLE "new_Warehouse" RENAME TO "Warehouse";
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE INDEX "Warehouse_kind_idx" ON "Warehouse"("kind");
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");
CREATE INDEX "Warehouse_deletedAt_idx" ON "Warehouse"("deletedAt");
CREATE INDEX "Warehouse_isActive_deletedAt_idx" ON "Warehouse"("isActive", "deletedAt");
CREATE INDEX "Warehouse_isActive_deletedAt_kind_idx" ON "Warehouse"("isActive", "deletedAt", "kind");
CREATE INDEX "Warehouse_code_idx" ON "Warehouse"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
