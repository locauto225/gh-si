/*
  Warnings:

  - A unique constraint covering the columns `[warehouseId]` on the table `Store` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Store_warehouseId_key" ON "Store"("warehouseId");
