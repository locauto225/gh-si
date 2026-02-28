"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryAddEventSchema = exports.deliverySetStatusSchema = exports.deliveryAssignSchema = exports.deliveryCreateAnySchema = exports.deliveryCreateWithoutSaleSchema = exports.deliveryLineWithoutSaleSchema = exports.deliveryCreateFromOrderSchema = exports.deliveryLineFromOrderSchema = exports.deliveryCreateSchema = exports.deliveryLineCreateSchema = exports.deliveriesAvailableQuerySchema = exports.deliveriesListQuerySchema = exports.TRANSFER_PURPOSES = exports.DELIVERY_STATUSES = void 0;
const zod_1 = require("zod");
// Statuts Delivery (aligné avec schema.prisma)
exports.DELIVERY_STATUSES = [
    "DRAFT",
    "PREPARED",
    "OUT_FOR_DELIVERY",
    "PARTIALLY_DELIVERED",
    "DELIVERED",
    "FAILED",
    "CANCELLED",
];
// Purpose du transfert stock associé (optionnel)
// (aligné avec enum StockTransferPurpose côté Prisma)
exports.TRANSFER_PURPOSES = [
    "INTERNAL_DELIVERY",
    "STORE_REPLENISH",
    "REBALANCE",
];
exports.deliveriesListQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    status: zod_1.z
        .string()
        .trim()
        .optional()
        .default("all"), // accepte "all" ou "DELIVERED,PARTIALLY_DELIVERED" (parsing côté service)
    warehouseId: zod_1.z.string().trim().min(1).optional(),
    driverId: zod_1.z.string().trim().min(1).optional(),
    // recherche simple (number / sale.number / client.nameSearch)
    q: zod_1.z.string().trim().min(1).optional(),
});
// BL disponibles = non affectés à une tournée / un arrêt
exports.deliveriesAvailableQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    // filtre optionnel
    warehouseId: zod_1.z.string().trim().min(1).optional(),
    // recherche simple (number / sale.number / client.nameSearch)
    q: zod_1.z.string().trim().min(1).optional(),
    // accepte "all" ou "PREPARED" ou "DRAFT,PREPARED" (parsing côté service)
    status: zod_1.z.string().trim().optional().default("PREPARED"),
});
exports.deliveryLineCreateSchema = zod_1.z.object({
    saleLineId: zod_1.z.string().trim().min(1, "saleLineId requis"),
    qtyDelivered: zod_1.z.coerce.number().int().positive("qtyDelivered doit être > 0"),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
exports.deliveryCreateSchema = zod_1.z.object({
    saleId: zod_1.z.string().trim().min(1, "saleId requis"),
    // Lien vers un transfert stock (optionnel) — 1 livraison = 1 transfert
    // Permet de rattacher un BL à un transfert existant (workflow expédition/réception).
    transferId: zod_1.z.string().trim().min(1).optional().nullable(),
    // driver optionnel en V1
    driverId: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    // lignes livrées pour CE BL (partiel possible)
    lines: zod_1.z.array(exports.deliveryLineCreateSchema).min(1, "Au moins une ligne requise"),
});
// ✅ Cas 1bis — BL depuis une commande (Order)
// body: { orderId: string, driverId?, note?, lines: [{ orderLineId? | productId?, qtyDelivered, note? }] }
exports.deliveryLineFromOrderSchema = zod_1.z
    .object({
    orderLineId: zod_1.z.string().trim().min(1).optional(),
    productId: zod_1.z.string().trim().min(1).optional(),
    qtyDelivered: zod_1.z.coerce.number().int().positive("qtyDelivered doit être > 0"),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
})
    .superRefine((data, ctx) => {
    const hasOrderLineId = !!(data.orderLineId && String(data.orderLineId).trim());
    const hasProductId = !!(data.productId && String(data.productId).trim());
    if (!hasOrderLineId && !hasProductId) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "orderLineId ou productId requis",
            path: ["orderLineId"],
        });
    }
});
exports.deliveryCreateFromOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().trim().min(1, "orderId requis"),
    // driver optionnel en V1
    driverId: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    // lignes livrées pour CE BL (partiel possible)
    lines: zod_1.z.array(exports.deliveryLineFromOrderSchema).min(1, "Au moins une ligne requise"),
});
// Lignes d'un BL "hors vente" (pas de saleLineId)
exports.deliveryLineWithoutSaleSchema = zod_1.z.object({
    productId: zod_1.z.string().trim().min(1, "productId requis"),
    qty: zod_1.z.coerce.number().int().positive("qty doit être > 0"),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
/**
 * Cas 2 — BL "hors vente"
 * On crée un BL interne basé sur un transfert stock (workflow expédition/réception)
 * sans être rattaché à une vente.
 */
exports.deliveryCreateWithoutSaleSchema = zod_1.z
    .object({
    // Source stock
    fromWarehouseId: zod_1.z.string().trim().min(1, "fromWarehouseId requis"),
    // Destination : soit un magasin, soit un entrepôt
    toStoreId: zod_1.z.string().trim().min(1).optional().nullable(),
    toWarehouseId: zod_1.z.string().trim().min(1).optional().nullable(),
    // driver optionnel
    driverId: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    // Optionnel: permet de forcer/qualifier le transfert créé (sinon défaut INTERNAL_DELIVERY côté service)
    transferPurpose: zod_1.z.enum(exports.TRANSFER_PURPOSES).optional().nullable(),
    // lignes livrées pour CE BL (partiel possible)
    lines: zod_1.z.array(exports.deliveryLineWithoutSaleSchema).min(1, "Au moins une ligne requise"),
})
    .superRefine((data, ctx) => {
    const hasStore = !!(data.toStoreId && String(data.toStoreId).trim());
    const hasWh = !!(data.toWarehouseId && String(data.toWarehouseId).trim());
    if (!hasStore && !hasWh) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Destination requise (toStoreId ou toWarehouseId)",
            path: ["toStoreId"],
        });
        return;
    }
    if (hasStore && hasWh) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Choisis soit toStoreId soit toWarehouseId (pas les deux).",
            path: ["toWarehouseId"],
        });
    }
});
// Schéma "global" si tu veux valider POST /deliveries avec les 2 cas.
exports.deliveryCreateAnySchema = zod_1.z.union([
    exports.deliveryCreateSchema,
    exports.deliveryCreateFromOrderSchema,
    exports.deliveryCreateWithoutSaleSchema,
]);
// Assigner une livraison à une tournée / un arrêt (Option A)
exports.deliveryAssignSchema = zod_1.z
    .object({
    tripId: zod_1.z.string().trim().min(1).optional().nullable(),
    stopId: zod_1.z.string().trim().min(1).optional().nullable(),
})
    .superRefine((data, ctx) => {
    const hasTrip = !!(data.tripId && String(data.tripId).trim());
    const hasStop = !!(data.stopId && String(data.stopId).trim());
    if (!hasTrip && !hasStop) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "tripId ou stopId requis",
            path: ["tripId"],
        });
    }
});
exports.deliverySetStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(exports.DELIVERY_STATUSES),
    // optionnel : message (ex: "Client absent", "Incident", ...)
    message: zod_1.z.string().trim().max(255).optional().nullable(),
});
exports.deliveryAddEventSchema = zod_1.z.object({
    type: zod_1.z.string().trim().min(1).max(60), // ex: NOTE / ISSUE / CALL / etc.
    message: zod_1.z.string().trim().max(255).optional().nullable(),
    meta: zod_1.z.string().trim().max(2000).optional().nullable(), // JSON compact si tu veux
});
