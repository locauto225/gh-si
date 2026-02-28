import { z } from "zod";

/**
 * Statuts FNE (aligné avec enum FneStatus dans Prisma)
 */
export const fneStatusSchema = z.enum(["PENDING", "SENT", "ACCEPTED", "ERROR"]);
export type FneStatusInput = z.infer<typeof fneStatusSchema>;

/**
 * GET /fne/events?entity=invoice|sale&entityId=...&status=...&limit=...
 */
export const fneEventsListQuerySchema = z.object({
  entity: z.enum(["invoice", "sale"]).optional(),
  entityId: z.string().trim().min(1).optional(),
  status: fneStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type FneEventsListQuery = z.infer<typeof fneEventsListQuerySchema>;

/**
 * POST /fne/events (simulation / debug / audit)
 * - invoiceId XOR saleId (exactement un des deux)
 */
export const fneEventCreateSchema = z
  .object({
    invoiceId: z.string().trim().min(1).optional(),
    saleId: z.string().trim().min(1).optional(),

    status: fneStatusSchema,

    // audit/debug (V1)
    payloadHash: z.string().trim().max(120).optional().nullable(),
    request: z.string().trim().max(100_000).optional().nullable(),
    response: z.string().trim().max(100_000).optional().nullable(),
    error: z.string().trim().max(50_000).optional().nullable(),

    // optionnel: si tu veux écrire l'identifiant retourné par la DGI
    fneRef: z.string().trim().max(120).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    const hasInvoice = !!v.invoiceId;
    const hasSale = !!v.saleId;
    if (hasInvoice === hasSale) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invoiceId ou saleId requis (un seul des deux).",
        path: ["invoiceId"],
      });
    }
  });

export type FneEventCreateInput = z.infer<typeof fneEventCreateSchema>;

/**
 * GET /fne/summary
 * (pour tableau Fiscal)
 */
export const fneSummaryQuerySchema = z.object({
  // plus tard si tu veux filtrer par warehouseId, etc.
});
export type FneSummaryQuery = z.infer<typeof fneSummaryQuerySchema>;