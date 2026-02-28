"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeSetStatusSchema = exports.storeUpdateSchema = exports.storeCreateSchema = exports.storesListQuerySchema = void 0;
// apps/api/src/modules/stores/stores.schemas.ts
const zod_1 = require("zod");
exports.storesListQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "inactive", "all"]).default("active"),
    q: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.storeCreateSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(20),
    name: zod_1.z.string().trim().min(1).max(120),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    isActive: zod_1.z.boolean().optional(), // toléré en create, mais service garde cohérence
});
exports.storeUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120).optional(),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    priceListId: zod_1.z
        .string()
        .trim()
        .min(1)
        .nullable()
        .optional()
        .transform((v) => (v === "" ? null : v)),
    // ⚠️ volontairement PAS de isActive/deletedAt ici (on force via PATCH /:id/status)
});
exports.storeSetStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
