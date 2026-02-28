"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseReceiveSchema = exports.purchaseStatusSchema = exports.purchaseCreateSchema = exports.purchasesListQuerySchema = void 0;
const zod_1 = require("zod");
const purchaseStatusEnum = zod_1.z.enum([
    "DRAFT",
    "ORDERED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CANCELLED",
]);
exports.purchasesListQuerySchema = zod_1.z.object({
    status: zod_1.z.preprocess((v) => {
        if (v === undefined || v === null)
            return "all";
        const s = String(v).trim();
        if (!s)
            return "all";
        if (s === "all")
            return "all";
        if (s.includes(",")) {
            return s
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
        }
        return s;
    }, zod_1.z.union([zod_1.z.literal("all"), purchaseStatusEnum, zod_1.z.array(purchaseStatusEnum).min(1)])),
    q: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.purchaseCreateSchema = zod_1.z.object({
    supplierId: zod_1.z.string().min(1, "supplierId requis"),
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
    note: zod_1.z.string().trim().max(1000).optional().nullable(),
    lines: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.string().min(1, "productId requis"),
        qtyOrdered: zod_1.z.number().int().positive("qtyOrdered doit être > 0"),
        unitPrice: zod_1.z.number().int().min(0, "unitPrice doit être >= 0"),
    }))
        .min(1, "Au moins une ligne est requise"),
});
exports.purchaseStatusSchema = zod_1.z.object({
    status: purchaseStatusEnum,
});
exports.purchaseReceiveSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(1000).optional().nullable(),
    lines: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.string().min(1, "productId requis"),
        qtyReceived: zod_1.z.number().int().min(0, "qtyReceived doit être >= 0"),
    }))
        .min(1, "Au moins une ligne est requise"),
});
