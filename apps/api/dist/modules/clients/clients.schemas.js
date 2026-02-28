"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientStatusSchema = exports.clientUpdateSchema = exports.clientCreateSchema = exports.clientsListQuerySchema = void 0;
const zod_1 = require("zod");
exports.clientsListQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "inactive", "all"]).default("active"),
    q: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(100),
});
exports.clientCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "name requis").max(120),
    contactName: zod_1.z.string().trim().max(120).optional().nullable(),
    phone: zod_1.z.string().trim().max(50).optional().nullable(),
    email: zod_1.z.string().trim().max(120).optional().nullable(),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    taxId: zod_1.z.string().trim().max(80).optional().nullable(),
    paymentTermsDays: zod_1.z.coerce.number().int().min(0).max(3650).optional().nullable(),
    creditLimit: zod_1.z.coerce.number().int().min(0).optional().nullable(),
    // V1: autorisé, mais tu peux aussi décider de forcer actif à la création
    isActive: zod_1.z.boolean().optional(),
});
exports.clientUpdateSchema = zod_1.z.object({
    // On autorise le renommage, contrairement au SKU côté produit
    name: zod_1.z.string().trim().min(1).max(120).optional(),
    contactName: zod_1.z.string().trim().max(120).optional().nullable(),
    phone: zod_1.z.string().trim().max(50).optional().nullable(),
    email: zod_1.z.string().trim().max(120).optional().nullable(),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    taxId: zod_1.z.string().trim().max(80).optional().nullable(),
    paymentTermsDays: zod_1.z.coerce.number().int().min(0).max(3650).optional().nullable(),
    creditLimit: zod_1.z.coerce.number().int().min(0).optional().nullable(),
});
exports.clientStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
