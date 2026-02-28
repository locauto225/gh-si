"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockTransfersListQuerySchema = exports.stockTransferReceiveSchema = exports.stockTransferReceiveLineSchema = exports.stockTransferShipSchema = exports.stockTransferIdParamsSchema = exports.stockTransferCreateSchema = exports.stockTransferLineSchema = exports.stockLossCreateSchema = exports.stockReturnCreateSchema = exports.stockAdjustmentCreateSchema = exports.stockMoveCreateSchema = exports.stockListQuerySchema = void 0;
const zod_1 = require("zod");
exports.stockListQuerySchema = zod_1.z.object({
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
});
exports.stockMoveCreateSchema = zod_1.z
    .object({
    kind: zod_1.z.enum(["IN", "OUT", "ADJUST"]),
    warehouseId: zod_1.z.string().min(1),
    productId: zod_1.z.string().min(1),
    // delta signé : + pour entrée, - pour sortie.
    // Convention:
    // - IN: qtyDelta > 0
    // - OUT: qtyDelta < 0
    // - ADJUST: qtyDelta != 0
    qtyDelta: zod_1.z.number().int(),
    refType: zod_1.z.string().trim().max(50).optional().nullable(),
    refId: zod_1.z.string().trim().max(80).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
})
    .superRefine((val, ctx) => {
    if (val.kind === "IN" && !(val.qtyDelta > 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["qtyDelta"],
            message: "qtyDelta doit être > 0 pour IN",
        });
    }
    if (val.kind === "OUT" && !(val.qtyDelta < 0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["qtyDelta"],
            message: "qtyDelta doit être < 0 pour OUT",
        });
    }
    if (val.kind === "ADJUST" && val.qtyDelta === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["qtyDelta"],
            message: "qtyDelta ne peut pas être 0 pour ADJUST",
        });
    }
});
// --- Adjustments (corrections) : endpoint dédié /stock/adjustments
exports.stockAdjustmentCreateSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
    productId: zod_1.z.string().min(1, "productId requis"),
    // delta signé : ex +3 ou -2 (non nul)
    qtyDelta: zod_1.z.number().int().refine((v) => v !== 0, "qtyDelta ne peut pas être 0"),
    // note obligatoire + plus stricte (audit)
    note: zod_1.z.string().trim().min(3, "note requise").max(255),
});
// --- Returns (retours) : endpoint dédié /stock/returns
exports.stockReturnCreateSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
    productId: zod_1.z.string().min(1, "productId requis"),
    // quantité retournée (toujours > 0). Le backend transformera en qtyDelta positif.
    qty: zod_1.z.number().int().positive("qty doit être > 0"),
    // raison / motif métier (obligatoire)
    reason: zod_1.z.string().trim().min(2, "reason requis").max(80),
    // note libre (optionnel)
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
// --- Losses (casse/vol) : endpoint dédié /stock/losses
exports.stockLossCreateSchema = zod_1.z.object({
    warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
    productId: zod_1.z.string().min(1, "productId requis"),
    // quantité (toujours > 0). Le backend transformera en qtyDelta négatif.
    qty: zod_1.z.number().int().positive("qty doit être > 0"),
    // type métier (obligatoire)
    type: zod_1.z.enum(["BREAK", "THEFT"]),
    // note obligatoire + plus stricte (audit)
    note: zod_1.z.string().trim().min(10, "note requise (min 10)").max(255),
});
// --- Transfers (endpoint dédié /stock/transfers)
exports.stockTransferLineSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "productId requis"),
    qty: zod_1.z.number().int().positive("qty doit être > 0"),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
exports.stockTransferCreateSchema = zod_1.z
    .object({
    fromWarehouseId: zod_1.z.string().min(1, "fromWarehouseId requis"),
    toWarehouseId: zod_1.z.string().min(1, "toWarehouseId requis"),
    // note globale du transfert (optionnel)
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    // multi-lignes
    lines: zod_1.z
        .array(exports.stockTransferLineSchema)
        .min(1, "Au moins une ligne requise")
        .max(200, "Trop de lignes (max 200)"),
})
    .superRefine((val, ctx) => {
    // garde-fou : source != destination
    if (val.fromWarehouseId === val.toWarehouseId) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["toWarehouseId"],
            message: "La destination doit être différente de la source",
        });
    }
    // garde-fou : pas de doublons productId
    const seen = new Set();
    for (let i = 0; i < val.lines.length; i++) {
        const pid = String(val.lines[i]?.productId || "").trim();
        if (!pid)
            continue;
        if (seen.has(pid)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["lines", i, "productId"],
                message: "Produit en doublon dans le transfert",
            });
        }
        else {
            seen.add(pid);
        }
    }
});
// --- Transfer params (id)
exports.stockTransferIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, "id requis"),
});
// --- Transfer workflow (expédition / réception)
// POST /stock/transfers/:id/ship
exports.stockTransferShipSchema = zod_1.z.object({
    // note d'expédition (optionnelle)
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
exports.stockTransferReceiveLineSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "productId requis"),
    // quantité réellement reçue (>= 0). Les contrôles métier (<= qty envoyée) sont côté service.
    qtyReceived: zod_1.z.number().int().min(0, "qtyReceived doit être >= 0"),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
});
// POST /stock/transfers/:id/receive
exports.stockTransferReceiveSchema = zod_1.z
    .object({
    // note globale de réception (optionnelle)
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    lines: zod_1.z
        .array(exports.stockTransferReceiveLineSchema)
        .min(1, "Au moins une ligne requise")
        .max(200, "Trop de lignes (max 200)"),
})
    .superRefine((val, ctx) => {
    // garde-fou : pas de doublons productId
    const seen = new Set();
    for (let i = 0; i < val.lines.length; i++) {
        const pid = String(val.lines[i]?.productId || "").trim();
        if (!pid)
            continue;
        if (seen.has(pid)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["lines", i, "productId"],
                message: "Produit en doublon dans la réception",
            });
        }
        else {
            seen.add(pid);
        }
    }
});
exports.stockTransfersListQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(100),
});
