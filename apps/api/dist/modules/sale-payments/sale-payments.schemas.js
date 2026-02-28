"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salePaymentCreateBodySchema = exports.salePaymentParamsSchema = void 0;
const zod_1 = require("zod");
exports.salePaymentParamsSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "sale id requis"),
});
exports.salePaymentCreateBodySchema = zod_1.z.object({
    method: zod_1.z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
    amount: zod_1.z.number().int().positive("amount doit être > 0"),
    reference: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    receivedAt: zod_1.z.coerce.date().optional().nullable(), // si absent => now()
});
