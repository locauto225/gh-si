"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryPostSchema = exports.inventoryLineUpdateSchema = exports.inventoryGenerateLinesSchema = exports.inventoryCreateSchema = exports.inventoriesListQuerySchema = exports.inventoryLineStatusSchema = exports.inventoryModeSchema = exports.inventoryStatusSchema = void 0;
const zod_1 = require("zod");
exports.inventoryStatusSchema = zod_1.z.enum(["DRAFT", "POSTED", "CANCELLED"]);
exports.inventoryModeSchema = zod_1.z.enum(["FULL", "CATEGORY", "FREE"]);
exports.inventoryLineStatusSchema = zod_1.z.enum(["PENDING", "COUNTED", "SKIPPED"]);
exports.inventoriesListQuerySchema = zod_1.z.object({
    warehouseId: zod_1.z.string().optional(),
    status: exports.inventoryStatusSchema.optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
// CREATE inventory draft (document)
exports.inventoryCreateSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
    mode: exports.inventoryModeSchema.default("FULL"),
    categoryId: zod_1.z.string().optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
// GENERATE lines
exports.inventoryGenerateLinesSchema = zod_1.z.object({
    mode: exports.inventoryModeSchema.optional(), // si tu veux forcer à ce moment-là
    categoryId: zod_1.z.string().optional().nullable(),
});
// UPDATE one line (counting)
exports.inventoryLineUpdateSchema = zod_1.z.object({
    countedQty: zod_1.z.coerce.number().int().min(0, "countedQty doit être >= 0").optional(),
    status: exports.inventoryLineStatusSchema.optional(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
// POST / close inventory
exports.inventoryPostSchema = zod_1.z.object({
    // garde-fou audit : note obligatoire
    note: zod_1.z.string().trim().min(3, "note obligatoire").max(255),
    // optionnel pour plus tard (quand tu ajoutes auth/roles)
    postedBy: zod_1.z.string().trim().max(80).optional().nullable(),
});
