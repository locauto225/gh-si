/*
  Warnings:

  - A unique constraint covering the columns `[trackingToken]` on the table `Delivery` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "trackingToken" TEXT;

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT,
    "message" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeliveryEvent_deliveryId_idx" ON "DeliveryEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_createdAt_idx" ON "DeliveryEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_type_idx" ON "DeliveryEvent"("type");

-- CreateIndex
CREATE INDEX "DeliveryEvent_status_idx" ON "DeliveryEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_trackingToken_key" ON "Delivery"("trackingToken");

-- CreateIndex
CREATE INDEX "Delivery_trackingToken_idx" ON "Delivery"("trackingToken");
