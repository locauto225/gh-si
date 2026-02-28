-- CreateIndex
CREATE INDEX "StockItem_warehouseId_productId_idx" ON "StockItem"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "StockMove_warehouseId_productId_idx" ON "StockMove"("warehouseId", "productId");
