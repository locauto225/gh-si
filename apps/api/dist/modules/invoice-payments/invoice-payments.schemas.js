"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicePaymentCreateBodySchema = exports.invoicePaymentParamsSchema = void 0;
const zod_1 = require("zod");
exports.invoicePaymentParamsSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "invoice id requis"),
});
exports.invoicePaymentCreateBodySchema = zod_1.z.object({
    method: zod_1.z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
    amount: zod_1.z.number().int().positive("amount doit être > 0"),
    reference: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    receivedAt: zod_1.z.coerce.date().optional().nullable(),
});
