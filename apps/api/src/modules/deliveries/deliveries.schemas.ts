import { z } from "zod";

// Statuts Delivery (aligné avec schema.prisma)
export const DELIVERY_STATUSES = [
  "DRAFT",
  "PREPARED",
  "OUT_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// Purpose du transfert stock associé (optionnel)
// (aligné avec enum StockTransferPurpose côté Prisma)
export const TRANSFER_PURPOSES = [
  "INTERNAL_DELIVERY",
  "STORE_REPLENISH",
  "REBALANCE",
] as const;
export type TransferPurpose = (typeof TRANSFER_PURPOSES)[number];


export const deliveriesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),

  status: z
    .string()
    .trim()
    .optional()
    .default("all"), // accepte "all" ou "DELIVERED,PARTIALLY_DELIVERED" (parsing côté service)

  warehouseId: z.string().trim().min(1).optional(),
  driverId: z.string().trim().min(1).optional(),

  // recherche simple (number / sale.number / client.nameSearch)
  q: z.string().trim().min(1).optional(),
});

// BL disponibles = non affectés à une tournée / un arrêt
export const deliveriesAvailableQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),

  // filtre optionnel
  warehouseId: z.string().trim().min(1).optional(),

  // recherche simple (number / sale.number / client.nameSearch)
  q: z.string().trim().min(1).optional(),

  // accepte "all" ou "PREPARED" ou "DRAFT,PREPARED" (parsing côté service)
  status: z.string().trim().optional().default("PREPARED"),
});

export const deliveryLineCreateSchema = z.object({
  saleLineId: z.string().trim().min(1, "saleLineId requis"),
  qtyDelivered: z.coerce.number().int().positive("qtyDelivered doit être > 0"),
  note: z.string().trim().max(255).optional().nullable(),
});

export const deliveryCreateSchema = z.object({
  saleId: z.string().trim().min(1, "saleId requis"),

  // Lien vers un transfert stock (optionnel) — 1 livraison = 1 transfert
  // Permet de rattacher un BL à un transfert existant (workflow expédition/réception).
  transferId: z.string().trim().min(1).optional().nullable(),

  // driver optionnel en V1
  driverId: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),

  // lignes livrées pour CE BL (partiel possible)
  lines: z.array(deliveryLineCreateSchema).min(1, "Au moins une ligne requise"),
});

// ✅ Cas 1bis — BL depuis une commande (Order)
// body: { orderId: string, driverId?, note?, lines: [{ orderLineId? | productId?, qtyDelivered, note? }] }
export const deliveryLineFromOrderSchema = z
  .object({
    orderLineId: z.string().trim().min(1).optional(),
    productId: z.string().trim().min(1).optional(),
    qtyDelivered: z.coerce.number().int().positive("qtyDelivered doit être > 0"),
    note: z.string().trim().max(255).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasOrderLineId = !!(data.orderLineId && String(data.orderLineId).trim());
    const hasProductId = !!(data.productId && String(data.productId).trim());
    if (!hasOrderLineId && !hasProductId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "orderLineId ou productId requis",
        path: ["orderLineId"],
      });
    }
  });

export const deliveryCreateFromOrderSchema = z.object({
  orderId: z.string().trim().min(1, "orderId requis"),

  // driver optionnel en V1
  driverId: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),

  // lignes livrées pour CE BL (partiel possible)
  lines: z.array(deliveryLineFromOrderSchema).min(1, "Au moins une ligne requise"),
});

// Lignes d'un BL "hors vente" (pas de saleLineId)
export const deliveryLineWithoutSaleSchema = z.object({
  productId: z.string().trim().min(1, "productId requis"),
  qty: z.coerce.number().int().positive("qty doit être > 0"),
  note: z.string().trim().max(255).optional().nullable(),
});

/**
 * Cas 2 — BL "hors vente"
 * On crée un BL interne basé sur un transfert stock (workflow expédition/réception)
 * sans être rattaché à une vente.
 */
export const deliveryCreateWithoutSaleSchema = z
  .object({
    // Source stock
    fromWarehouseId: z.string().trim().min(1, "fromWarehouseId requis"),

    // Destination : soit un magasin, soit un entrepôt
    toStoreId: z.string().trim().min(1).optional().nullable(),
    toWarehouseId: z.string().trim().min(1).optional().nullable(),

    // driver optionnel
    driverId: z.string().trim().min(1).optional().nullable(),
    note: z.string().trim().max(255).optional().nullable(),

    // Optionnel: permet de forcer/qualifier le transfert créé (sinon défaut INTERNAL_DELIVERY côté service)
    transferPurpose: z.enum(TRANSFER_PURPOSES).optional().nullable(),

    // lignes livrées pour CE BL (partiel possible)
    lines: z.array(deliveryLineWithoutSaleSchema).min(1, "Au moins une ligne requise"),
  })
  .superRefine((data, ctx) => {
    const hasStore = !!(data.toStoreId && String(data.toStoreId).trim());
    const hasWh = !!(data.toWarehouseId && String(data.toWarehouseId).trim());
    if (!hasStore && !hasWh) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Destination requise (toStoreId ou toWarehouseId)",
        path: ["toStoreId"],
      });
      return;
    }
    if (hasStore && hasWh) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choisis soit toStoreId soit toWarehouseId (pas les deux).",
        path: ["toWarehouseId"],
      });
    }
  });

// Schéma "global" si tu veux valider POST /deliveries avec les 2 cas.

export const deliveryCreateAnySchema = z.union([
  deliveryCreateSchema,
  deliveryCreateFromOrderSchema,
  deliveryCreateWithoutSaleSchema,
]);

// Assigner une livraison à une tournée / un arrêt (Option A)
export const deliveryAssignSchema = z
  .object({
    tripId: z.string().trim().min(1).optional().nullable(),
    stopId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasTrip = !!(data.tripId && String(data.tripId).trim());
    const hasStop = !!(data.stopId && String(data.stopId).trim());
    if (!hasTrip && !hasStop) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tripId ou stopId requis",
        path: ["tripId"],
      });
    }
  });

export const deliverySetStatusSchema = z.object({
  status: z.enum(DELIVERY_STATUSES),
  // optionnel : message (ex: "Client absent", "Incident", ...)
  message: z.string().trim().max(255).optional().nullable(),
});

export const deliveryAddEventSchema = z.object({
  type: z.string().trim().min(1).max(60), // ex: NOTE / ISSUE / CALL / etc.
  message: z.string().trim().max(255).optional().nullable(),
  meta: z.string().trim().max(2000).optional().nullable(), // JSON compact si tu veux
});

export type DeliveriesListQuery = z.infer<typeof deliveriesListQuerySchema>;
export type DeliveriesAvailableQuery = z.infer<typeof deliveriesAvailableQuerySchema>;
export type DeliveryCreateInput = z.infer<typeof deliveryCreateAnySchema>;
export type DeliveryCreateWithoutSaleInput = z.infer<typeof deliveryCreateWithoutSaleSchema>;
export type DeliveryAssignInput = z.infer<typeof deliveryAssignSchema>;
export type DeliverySetStatusInput = z.infer<typeof deliverySetStatusSchema>;
export type DeliveryAddEventInput = z.infer<typeof deliveryAddEventSchema>;