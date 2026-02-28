"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopDeliveriesAttachSchema = exports.stopPaymentCreateSchema = exports.stopSetStatusSchema = exports.deliveryStopCreateSchema = exports.deliveryTripSetStatusSchema = exports.deliveryTripCreateSchema = exports.deliveryTripsListQuerySchema = void 0;
// apps/api/src/modules/delivery-trips/delivery-trips.schemas.ts
const zod_1 = require("zod");
exports.deliveryTripsListQuerySchema = zod_1.z.object({
    status: zod_1.z
        .enum(["DRAFT", "LOADED", "IN_PROGRESS", "DONE", "CLOSED", "CANCELLED"])
        .optional(),
    fromWarehouseId: zod_1.z.string().trim().optional(),
    driverId: zod_1.z.string().trim().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
});
exports.deliveryTripCreateSchema = zod_1.z.object({
    fromWarehouseId: zod_1.z.string().trim().min(1),
    driverId: zod_1.z.string().trim().optional().nullable(),
    note: zod_1.z.string().trim().optional().nullable(),
});
exports.deliveryTripSetStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["DRAFT", "LOADED", "IN_PROGRESS", "DONE", "CLOSED", "CANCELLED"]),
    note: zod_1.z.string().trim().optional().nullable(),
});
exports.deliveryStopCreateSchema = zod_1.z.object({
    // ordre : si absent => on ajoute à la fin
    sequence: zod_1.z.coerce.number().int().min(1).optional(),
    clientId: zod_1.z.string().trim().optional().nullable(),
    storeId: zod_1.z.string().trim().optional().nullable(),
    addressSnapshot: zod_1.z.string().trim().optional().nullable(),
    phoneSnapshot: zod_1.z.string().trim().optional().nullable(),
    contactNameSnapshot: zod_1.z.string().trim().optional().nullable(),
    note: zod_1.z.string().trim().optional().nullable(),
    // Option A: ventes rattachées au stop
    saleIds: zod_1.z.array(zod_1.z.string().trim().min(1)).optional().default([]),
});
exports.stopSetStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["PENDING", "VISITED", "PARTIAL", "DONE", "FAILED", "CANCELLED"]),
    note: zod_1.z.string().trim().optional().nullable(),
    visitedAt: zod_1.z.coerce.date().optional(),
});
exports.stopPaymentCreateSchema = zod_1.z.object({
    method: zod_1.z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
    amount: zod_1.z.coerce.number().int().min(0),
    reference: zod_1.z.string().trim().optional().nullable(),
    note: zod_1.z.string().trim().optional().nullable(),
    receivedAt: zod_1.z.coerce.date().optional(),
});
// Bulk attach deliveries to a stop (dispatch depuis l'arrêt)
exports.stopDeliveriesAttachSchema = zod_1.z.object({
    deliveryIds: zod_1.z.array(zod_1.z.string().trim().min(1)).min(1),
});
