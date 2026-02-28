"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceListItemUpdateSchema = exports.priceListItemCreateSchema = exports.priceListUpdateSchema = exports.priceListCreateSchema = exports.pricelistsListQuerySchema = void 0;
// apps/api/src/modules/pricelists/pricelists.schemas.ts
const zod_1 = require("zod");
/**
 * status:
 * - active   => isActive = true AND deletedAt = null
 * - inactive => isActive = false AND deletedAt = null
 * - all      => (ignore isActive) AND deletedAt = null
 * (les supprimés = deletedAt != null ne sortent pas)
 */
exports.pricelistsListQuerySchema = zod_1.z.object({
    q: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(["active", "inactive", "all"]).default("active"),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.priceListCreateSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(2).max(40),
    name: zod_1.z.string().trim().min(2).max(120),
    note: zod_1.z.string().trim().max(500).optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
exports.priceListUpdateSchema = zod_1.z.object({
    // Pro: on ne modifie pas code en update (stable pour exports/intégrations)
    name: zod_1.z.string().trim().min(2).max(120).optional(),
    note: zod_1.z.string().trim().max(500).optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    deletedAt: zod_1.z.coerce.date().optional().nullable(), // si tu veux soft delete via update
});
exports.priceListItemCreateSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "productId requis"),
    unitPrice: zod_1.z.number().int().min(0, "unitPrice doit être >= 0"),
});
exports.priceListItemUpdateSchema = zod_1.z.object({
    unitPrice: zod_1.z.number().int().min(0, "unitPrice doit être >= 0"),
});
