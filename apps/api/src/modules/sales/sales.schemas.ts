import { z } from "zod";

export const saleLineInputSchema = z.object({
  productId: z.string().min(1, "productId requis"),
  qty: z.number().int().positive("qty doit être > 0"),
  unitPrice: z.number().int().min(0, "unitPrice doit être >= 0").optional(),
});

export const saleCreateSchema = z
  .object({
    // POS: on s'appuie sur le magasin (store) et son entrepôt associé
    warehouseId: z.string().min(1, "warehouseId requis"),

    // POS only
    storeId: z.string().trim().min(1, "storeId requis"),

    // Optionnel: client comptoir possible
    clientId: z.string().trim().min(1).nullable().optional(),

    note: z.string().trim().max(255).optional().nullable(),

    // POS: par défaut enlèvement, frais livraison non supportés ici
    fulfillment: z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
    shippingFee: z.number().int().min(0, "shippingFee doit être >= 0").optional().default(0),

    lines: z.array(saleLineInputSchema).min(1, "Au moins une ligne requise"),
  })
  .superRefine((val, ctx) => {
    // POS: par défaut on n'autorise pas de frais de livraison
    if (val.fulfillment === "PICKUP" && (val.shippingFee ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingFee"],
        message: "shippingFee doit être 0 quand fulfillment=PICKUP",
      });
    }

    // POS only: si DELIVERY, on garde la contrainte simple (support futur)
    if (val.fulfillment === "DELIVERY" && (val.shippingFee ?? 0) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingFee"],
        message: "shippingFee invalide",
      });
    }

    // storeId est obligatoire (déjà validé), rien de plus ici
  });

// Quote/preview: même shape que create (permet de calculer les prix/totaux sans créer en DB)
export const saleQuoteSchema = saleCreateSchema;

export const saleSetStatusSchema = z.object({
  // V1 "pro": on ne peut pas repasser une vente à DRAFT via PATCH status.
  // Transitions autorisées côté service: DRAFT -> POSTED/CANCELLED.
  status: z.enum(["POSTED", "CANCELLED"]),
});

/**
 * GET /sales?status=...&warehouseId=...&storeId=...&q=...&limit=...
 * status accepte:
 * - "all"
 * - "POSTED"
 * - "POSTED,CANCELLED"
 */
export const salesListQuerySchema = z
  .object({
    status: z.string().trim().optional().default("all"),
    warehouseId: z.string().trim().min(1).optional(),
    storeId: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .superRefine((_val, _ctx) => {
    // POS-only: pas de logique channel/storeId ici
  });

export type SaleLineInput = z.infer<typeof saleLineInputSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
export type SaleQuoteInput = z.infer<typeof saleQuoteSchema>;
export type SaleSetStatusInput = z.infer<typeof saleSetStatusSchema>;
export type SalesListQuery = z.infer<typeof salesListQuerySchema>;