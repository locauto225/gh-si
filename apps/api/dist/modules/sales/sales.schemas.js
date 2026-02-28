"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesListQuerySchema = exports.saleSetStatusSchema = exports.saleQuoteSchema = exports.saleCreateSchema = exports.saleLineInputSchema = void 0;
const zod_1 = require("zod");
exports.saleLineInputSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "productId requis"),
    qty: zod_1.z.number().int().positive("qty doit être > 0"),
    unitPrice: zod_1.z.number().int().min(0, "unitPrice doit être >= 0").optional(),
});
exports.saleCreateSchema = zod_1.z
    .object({
    // POS: on s'appuie sur le magasin (store) et son entrepôt associé
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
    // POS only
    storeId: zod_1.z.string().trim().min(1, "storeId requis"),
    // Optionnel: client comptoir possible
    clientId: zod_1.z.string().trim().min(1).nullable().optional(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    // POS: par défaut enlèvement, frais livraison non supportés ici
    fulfillment: zod_1.z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
    shippingFee: zod_1.z.number().int().min(0, "shippingFee doit être >= 0").optional().default(0),
    lines: zod_1.z.array(exports.saleLineInputSchema).min(1, "Au moins une ligne requise"),
})
    .superRefine((val, ctx) => {
    // POS: par défaut on n'autorise pas de frais de livraison
    if (val.fulfillment === "PICKUP" && (val.shippingFee ?? 0) > 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["shippingFee"],
            message: "shippingFee doit être 0 quand fulfillment=PICKUP",
        });
    }
    // POS only: si DELIVERY, on garde la contrainte simple (support futur)
    if (val.fulfillment === "DELIVERY" && (val.shippingFee ?? 0) < 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["shippingFee"],
            message: "shippingFee invalide",
        });
    }
    // storeId est obligatoire (déjà validé), rien de plus ici
});
// Quote/preview: même shape que create (permet de calculer les prix/totaux sans créer en DB)
exports.saleQuoteSchema = exports.saleCreateSchema;
exports.saleSetStatusSchema = zod_1.z.object({
    // V1 "pro": on ne peut pas repasser une vente à DRAFT via PATCH status.
    // Transitions autorisées côté service: DRAFT -> POSTED/CANCELLED.
    status: zod_1.z.enum(["POSTED", "CANCELLED"]),
});
/**
 * GET /sales?status=...&warehouseId=...&storeId=...&q=...&limit=...
 * status accepte:
 * - "all"
 * - "POSTED"
 * - "POSTED,CANCELLED"
 */
exports.salesListQuerySchema = zod_1.z
    .object({
    status: zod_1.z.string().trim().optional().default("all"),
    warehouseId: zod_1.z.string().trim().min(1).optional(),
    storeId: zod_1.z.string().trim().min(1).optional(),
    q: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(100),
})
    .superRefine((_val, _ctx) => {
    // POS-only: pas de logique channel/storeId ici
});
