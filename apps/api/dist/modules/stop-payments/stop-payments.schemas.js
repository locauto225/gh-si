"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopPaymentIdParamsSchema = exports.stopPaymentCreateSchema = exports.stopPaymentsListQuerySchema = void 0;
const zod_1 = require("zod");
exports.stopPaymentsListQuerySchema = zod_1.z.object({
    stopId: zod_1.z.string().trim().min(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
});
exports.stopPaymentCreateSchema = zod_1.z.object({
    stopId: zod_1.z.string().trim().min(1),
    method: zod_1.z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
    amount: zod_1.z.coerce.number().int().min(0),
    reference: zod_1.z.string().trim().optional().nullable(),
    note: zod_1.z.string().trim().optional().nullable(),
    receivedAt: zod_1.z.coerce.date().optional(),
});
exports.stopPaymentIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1),
});
