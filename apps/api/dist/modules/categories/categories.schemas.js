"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subCategoryCreateSchema = exports.deleteQuerySchema = exports.subCategoryIdParamSchema = exports.categoryIdParamSchema = exports.categoriesListQuerySchema = exports.categoryCreateSchema = void 0;
const zod_1 = require("zod");
exports.categoryCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
});
exports.categoriesListQuerySchema = zod_1.z.object({
    includeSubcategories: zod_1.z
        .preprocess((v) => (typeof v === "string" ? v.toLowerCase() === "true" : v), zod_1.z.boolean())
        .optional()
        .default(false),
});
// Params helpers (routes)
exports.categoryIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
exports.subCategoryIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    subId: zod_1.z.string().min(1),
});
// Delete query (future-safe)
// Today we do SAFE delete (soft-delete). `hard=true` can be supported later for unused entities.
exports.deleteQuerySchema = zod_1.z.object({
    hard: zod_1.z
        .preprocess((v) => (typeof v === "string" ? v.toLowerCase() === "true" : v), zod_1.z.boolean())
        .optional()
        .default(false),
});
exports.subCategoryCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
    categoryId: zod_1.z.string().min(1),
});
