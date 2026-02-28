"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierStatusSchema = exports.supplierUpdateSchema = exports.supplierCreateSchema = exports.suppliersListQuerySchema = void 0;
const zod_1 = require("zod");
exports.suppliersListQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "inactive", "all"]).default("active"),
    q: zod_1.z.string().trim().min(1).max(100).optional(), // recherche (name)
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
exports.supplierCreateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Nom requis").max(120),
    // Contacts
    phone: zod_1.z.string().trim().max(40).optional().nullable(),
    email: zod_1.z.string().trim().email("Email invalide").max(120).optional().nullable(),
    // Champs “pro” (facultatifs mais utiles)
    contactName: zod_1.z.string().trim().max(120).optional().nullable(),
    address: zod_1.z.string().trim().max(255).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    // Comptable / conditions commerciales (V1)
    paymentTermsDays: zod_1.z.coerce.number().int().min(0).max(365).optional().nullable(), // ex: 30
    creditLimit: zod_1.z.coerce.number().int().min(0).optional().nullable(), // FCFA
    taxId: zod_1.z.string().trim().max(60).optional().nullable(), // NIF/ID (si dispo)
});
exports.supplierUpdateSchema = exports.supplierCreateSchema
    .partial()
    .extend({
    // On évite de “casser” la fiche si quelqu’un envoie des champs vides
    name: zod_1.z.string().trim().min(2).max(120).optional(),
});
exports.supplierStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
