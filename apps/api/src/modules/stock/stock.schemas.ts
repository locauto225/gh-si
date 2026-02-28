import { z } from "zod";

export const stockListQuerySchema = z.object({
  warehouseId: z.string().min(1, "warehouseId requis"),
});

export const stockMoveCreateSchema = z
  .object({
    kind: z.enum(["IN", "OUT", "ADJUST"]),
    warehouseId: z.string().min(1),
    productId: z.string().min(1),

    // delta signé : + pour entrée, - pour sortie.
    // Convention:
    // - IN: qtyDelta > 0
    // - OUT: qtyDelta < 0
    // - ADJUST: qtyDelta != 0
    qtyDelta: z.number().int(),

    refType: z.string().trim().max(50).optional().nullable(),
    refId: z.string().trim().max(80).optional().nullable(),
    note: z.string().trim().max(255).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "IN" && !(val.qtyDelta > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qtyDelta"],
        message: "qtyDelta doit être > 0 pour IN",
      });
    }
    if (val.kind === "OUT" && !(val.qtyDelta < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qtyDelta"],
        message: "qtyDelta doit être < 0 pour OUT",
      });
    }
    if (val.kind === "ADJUST" && val.qtyDelta === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qtyDelta"],
        message: "qtyDelta ne peut pas être 0 pour ADJUST",
      });
    }
  });

// --- Adjustments (corrections) : endpoint dédié /stock/adjustments
export const stockAdjustmentCreateSchema = z.object({
  warehouseId: z.string().min(1, "warehouseId requis"),
  productId: z.string().min(1, "productId requis"),
  // delta signé : ex +3 ou -2 (non nul)
  qtyDelta: z.number().int().refine((v) => v !== 0, "qtyDelta ne peut pas être 0"),
  // note obligatoire + plus stricte (audit)
  note: z.string().trim().min(3, "note requise").max(255),
});

// --- Returns (retours) : endpoint dédié /stock/returns
export const stockReturnCreateSchema = z.object({
  warehouseId: z.string().min(1, "warehouseId requis"),
  productId: z.string().min(1, "productId requis"),
  // quantité retournée (toujours > 0). Le backend transformera en qtyDelta positif.
  qty: z.number().int().positive("qty doit être > 0"),
  // raison / motif métier (obligatoire)
  reason: z.string().trim().min(2, "reason requis").max(80),
  // note libre (optionnel)
  note: z.string().trim().max(255).optional().nullable(),
});

// --- Losses (casse/vol) : endpoint dédié /stock/losses
export const stockLossCreateSchema = z.object({
  warehouseId: z.string().min(1, "warehouseId requis"),
  productId: z.string().min(1, "productId requis"),
  // quantité (toujours > 0). Le backend transformera en qtyDelta négatif.
  qty: z.number().int().positive("qty doit être > 0"),
  // type métier (obligatoire)
  type: z.enum(["BREAK", "THEFT"]),
  // note obligatoire + plus stricte (audit)
  note: z.string().trim().min(10, "note requise (min 10)").max(255),
});


// --- Transfers (endpoint dédié /stock/transfers)
export const stockTransferLineSchema = z.object({
  productId: z.string().min(1, "productId requis"),
  qty: z.number().int().positive("qty doit être > 0"),
  note: z.string().trim().max(255).optional().nullable(),
});

export const stockTransferCreateSchema = z
  .object({
    fromWarehouseId: z.string().min(1, "fromWarehouseId requis"),
    toWarehouseId: z.string().min(1, "toWarehouseId requis"),

    // note globale du transfert (optionnel)
    note: z.string().trim().max(255).optional().nullable(),

    // multi-lignes
    lines: z
      .array(stockTransferLineSchema)
      .min(1, "Au moins une ligne requise")
      .max(200, "Trop de lignes (max 200)"),
  })
  .superRefine((val, ctx) => {
    // garde-fou : source != destination
    if (val.fromWarehouseId === val.toWarehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWarehouseId"],
        message: "La destination doit être différente de la source",
      });
    }

    // garde-fou : pas de doublons productId
    const seen = new Set<string>();
    for (let i = 0; i < val.lines.length; i++) {
      const pid = String(val.lines[i]?.productId || "").trim();
      if (!pid) continue;
      if (seen.has(pid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "productId"],
          message: "Produit en doublon dans le transfert",
        });
      } else {
        seen.add(pid);
      }
    }
  });

// --- Transfer params (id)
export const stockTransferIdParamsSchema = z.object({
  id: z.string().min(1, "id requis"),
});

// --- Transfer workflow (expédition / réception)
// POST /stock/transfers/:id/ship
export const stockTransferShipSchema = z.object({
  // note d'expédition (optionnelle)
  note: z.string().trim().max(255).optional().nullable(),
});

export const stockTransferReceiveLineSchema = z.object({
  productId: z.string().min(1, "productId requis"),
  // quantité réellement reçue (>= 0). Les contrôles métier (<= qty envoyée) sont côté service.
  qtyReceived: z.number().int().min(0, "qtyReceived doit être >= 0"),
  note: z.string().trim().max(255).optional().nullable(),
});

// POST /stock/transfers/:id/receive
export const stockTransferReceiveSchema = z
  .object({
    // note globale de réception (optionnelle)
    note: z.string().trim().max(255).optional().nullable(),

    lines: z
      .array(stockTransferReceiveLineSchema)
      .min(1, "Au moins une ligne requise")
      .max(200, "Trop de lignes (max 200)"),
  })
  .superRefine((val, ctx) => {
    // garde-fou : pas de doublons productId
    const seen = new Set<string>();
    for (let i = 0; i < val.lines.length; i++) {
      const pid = String(val.lines[i]?.productId || "").trim();
      if (!pid) continue;
      if (seen.has(pid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "productId"],
          message: "Produit en doublon dans la réception",
        });
      } else {
        seen.add(pid);
      }
    }
  });

export const stockTransfersListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type StockListQuery = z.infer<typeof stockListQuerySchema>;
export type StockMoveCreateInput = z.infer<typeof stockMoveCreateSchema>;
export type StockAdjustmentCreateInput = z.infer<typeof stockAdjustmentCreateSchema>;
export type StockReturnCreateInput = z.infer<typeof stockReturnCreateSchema>;
export type StockLossCreateInput = z.infer<typeof stockLossCreateSchema>;
export type StockTransferLineInput = z.infer<typeof stockTransferLineSchema>;
export type StockTransferCreateInput = z.infer<typeof stockTransferCreateSchema>;
export type StockTransferIdParams = z.infer<typeof stockTransferIdParamsSchema>;
export type StockTransferShipInput = z.infer<typeof stockTransferShipSchema>;
export type StockTransferReceiveLineInput = z.infer<typeof stockTransferReceiveLineSchema>;
export type StockTransferReceiveInput = z.infer<typeof stockTransferReceiveSchema>;
export type StockTransfersListQuery = z.infer<typeof stockTransfersListQuerySchema>;