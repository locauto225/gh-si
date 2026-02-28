-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "note" TEXT,
    "taxId" TEXT,
    "paymentTermsDays" INTEGER,
    "creditLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Supplier" ("address", "contactName", "createdAt", "creditLimit", "deletedAt", "email", "id", "isActive", "name", "note", "paymentTermsDays", "phone", "taxId", "updatedAt") SELECT "address", "contactName", "createdAt", "creditLimit", "deletedAt", "email", "id", "isActive", "name", "note", "paymentTermsDays", "phone", "taxId", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE INDEX "Supplier_nameSearch_idx" ON "Supplier"("nameSearch");
CREATE INDEX "Supplier_taxId_idx" ON "Supplier"("taxId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
