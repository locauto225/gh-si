"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fneSummaryQuerySchema = exports.fneEventCreateSchema = exports.fneEventsListQuerySchema = exports.fneStatusSchema = void 0;
const zod_1 = require("zod");
/**
 * Statuts FNE (aligné avec enum FneStatus dans Prisma)
 */
exports.fneStatusSchema = zod_1.z.enum(["PENDING", "SENT", "ACCEPTED", "ERROR"]);
/**
 * GET /fne/events?entity=invoice|sale&entityId=...&status=...&limit=...
 */
exports.fneEventsListQuerySchema = zod_1.z.object({
    entity: zod_1.z.enum(["invoice", "sale"]).optional(),
    entityId: zod_1.z.string().trim().min(1).optional(),
    status: exports.fneStatusSchema.optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(100),
});
/**
 * POST /fne/events (simulation / debug / audit)
 * - invoiceId XOR saleId (exactement un des deux)
 */
exports.fneEventCreateSchema = zod_1.z
    .object({
    invoiceId: zod_1.z.string().trim().min(1).optional(),
    saleId: zod_1.z.string().trim().min(1).optional(),
    status: exports.fneStatusSchema,
    // audit/debug (V1)
    payloadHash: zod_1.z.string().trim().max(120).optional().nullable(),
    request: zod_1.z.string().trim().max(100_000).optional().nullable(),
    response: zod_1.z.string().trim().max(100_000).optional().nullable(),
    error: zod_1.z.string().trim().max(50_000).optional().nullable(),
    // optionnel: si tu veux écrire l'identifiant retourné par la DGI
    fneRef: zod_1.z.string().trim().max(120).optional().nullable(),
})
    .superRefine((v, ctx) => {
    const hasInvoice = !!v.invoiceId;
    const hasSale = !!v.saleId;
    if (hasInvoice === hasSale) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "invoiceId ou saleId requis (un seul des deux).",
            path: ["invoiceId"],
        });
    }
});
/**
 * GET /fne/summary
 * (pour tableau Fiscal)
 */
exports.fneSummaryQuerySchema = zod_1.z.object({
// plus tard si tu veux filtrer par warehouseId, etc.
});
