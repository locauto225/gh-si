"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehousesListQuerySchema = exports.warehouseStatusSchema = exports.warehouseUpdateSchema = exports.warehouseCreateSchema = void 0;
const zod_1 = require("zod");
exports.warehouseCreateSchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .trim()
        .min(2, "Code requis")
        .max(32, "Code trop long")
        // simple + robuste (évite espaces/accents)
        .regex(/^[A-Z0-9_]+$/, "Code: A-Z, 0-9, underscore uniquement")
        .transform((v) => v.toUpperCase()),
    name: zod_1.z.string().trim().min(2, "Nom requis").max(120, "Nom trop long"),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
exports.warehouseUpdateSchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .trim()
        .min(2)
        .max(32)
        .regex(/^[A-Z0-9_]+$/)
        .transform((v) => v.toUpperCase())
        .optional(),
    name: zod_1.z.string().trim().min(2).max(120).optional(),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    // Grille tarifaire par défaut (nullable)
    priceListId: zod_1.z.string().trim().min(1).optional().nullable(),
});
exports.warehouseStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
// --- List query (GET /warehouses)
// status:
// - active   => isActive=true AND deletedAt=null
// - inactive => isActive=false OR deletedAt!=null
// - all      => no status filter
// kind:
// - DEPOT | STORE | all
exports.warehousesListQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "inactive", "all"]).default("active"),
    kind: zod_1.z.enum(["DEPOT", "STORE", "all"]).default("DEPOT"),
    q: zod_1.z
        .string()
        .trim()
        .min(1)
        .optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(100),
});
