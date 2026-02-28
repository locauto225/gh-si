"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productListQuerySchema = exports.productUpdateSchema = exports.productCreateSchema = void 0;
const zod_1 = require("zod");
exports.productCreateSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1).max(64),
    name: zod_1.z.string().min(1).max(200),
    unit: zod_1.z.string().min(1).max(32).optional(),
    price: zod_1.z.number().int().min(0).optional(), // FCFA (XOF) - entier
    isActive: zod_1.z.boolean().optional(),
    // ✅ Boissons (optionnels)
    brand: zod_1.z.string().min(1).max(120).optional(),
    barcode: zod_1.z.string().min(1).max(64).optional(),
    packSize: zod_1.z.number().int().min(1).optional(),
    // ✅ Catégorie (V1: optionnelle pour aller vite)
    categoryId: zod_1.z.string().min(1).optional(),
});
// Pro: on évite de modifier le SKU après création (risque chaos stock/facturation/intégrations)
exports.productUpdateSchema = exports.productCreateSchema.omit({ sku: true }).partial();
// Query params: /products?status=active&categoryId=...&q=...&limit=...
exports.productListQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "inactive", "all"]).optional().default("active"),
    categoryId: zod_1.z.string().min(1).optional(),
    q: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z
        .preprocess((v) => {
        if (v === undefined || v === null || v === "")
            return undefined;
        const n = typeof v === "number" ? v : Number(String(v));
        return Number.isFinite(n) ? n : undefined;
    }, zod_1.z.number().int().min(1).max(500).optional())
        .default(50),
});
