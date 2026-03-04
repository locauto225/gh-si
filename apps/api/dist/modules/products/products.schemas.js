"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productListQuerySchema = exports.productUpdateSchema = exports.productCreateSchema = void 0;
const zod_1 = require("zod");
const productBarcodeSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(1).max(64),
    label: zod_1.z.string().trim().min(1).max(64).optional(),
});
const productPackagingSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(64),
    units: zod_1.z.number().int().positive(),
    barcode: zod_1.z.string().trim().min(1).max(64).optional(),
});
const supplierLinkSchema = zod_1.z.object({
    supplierId: zod_1.z.string().trim().min(1),
    supplierSku: zod_1.z.string().trim().min(1).max(64).optional(),
    packagingId: zod_1.z.string().trim().min(1).optional(),
    lastUnitPrice: zod_1.z.number().int().min(0).optional(), // FCFA (XOF)
});
exports.productCreateSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1).max(64),
    name: zod_1.z.string().min(1).max(200),
    unit: zod_1.z.string().min(1).max(32).optional(),
    price: zod_1.z.number().int().min(0).optional(), // FCFA (XOF) - entier
    isActive: zod_1.z.boolean().optional(),
    // ✅ Achat (prix de référence)
    purchasePrice: zod_1.z.number().int().min(0).optional(), // FCFA (XOF) - entier
    // ✅ Boissons (optionnels)
    brand: zod_1.z.string().min(1).max(120).optional(),
    // ✅ Photo produit (optionnelle) — URL (CDN / Cloudinary)
    imageUrl: zod_1.z.string().trim().url().max(2048).optional(),
    // ✅ Catégorie
    categoryId: zod_1.z.string().min(1).optional(),
    // ✅ Nouveaux besoins
    barcodes: zod_1.z.array(productBarcodeSchema).optional(),
    packagings: zod_1.z.array(productPackagingSchema).optional(),
    subCategoryIds: zod_1.z.array(zod_1.z.string().trim().min(1)).optional(),
    suppliers: zod_1.z.array(supplierLinkSchema).optional(),
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
