"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDriverBodySchema = exports.createDriverBodySchema = exports.listDriversQuerySchema = void 0;
const zod_1 = require("zod");
exports.listDriversQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["active", "inactive", "all"]).optional().default("active"),
    q: zod_1.z.string().trim().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional().default(50),
});
exports.createDriverBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1),
    phone: zod_1.z.string().trim().optional().nullable(),
    email: zod_1.z.string().trim().email().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateDriverBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).optional(),
    phone: zod_1.z.string().trim().optional().nullable(),
    email: zod_1.z.string().trim().email().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    // (optionnel) soft delete si tu veux plus tard :
    // deletedAt: z.coerce.date().optional().nullable(),
});
