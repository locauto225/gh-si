"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const stock_schemas_1 = require("./stock.schemas");
const stock_service_1 = require("./stock.service");
const validate_1 = require("../../lib/validate");
const errors_1 = require("../../lib/errors");
exports.stockRouter = (0, express_1.Router)();
/**
 * GET /stock?warehouseId=...
 * Retourne: [{ product, quantity }]
 */
exports.stockRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(stock_schemas_1.stockListQuerySchema, {
        warehouseId: String(req.query.warehouseId ?? ""),
    });
    const items = await stock_service_1.stockService.listByWarehouse(q.warehouseId);
    res.json({ items });
});
/**
 * GET /stock/qty?warehouseId=...&productId=...
 * Retourne: { quantity }
 */
exports.stockRouter.get("/qty", async (req, res) => {
    const q = (0, validate_1.validate)(zod_1.z.object({
        warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
        productId: zod_1.z.string().min(1, "productId requis"),
    }), {
        warehouseId: String(req.query.warehouseId ?? ""),
        productId: String(req.query.productId ?? ""),
    });
    const quantity = await stock_service_1.stockService.getQty(q.warehouseId, q.productId);
    res.json({ quantity });
});
/**
 * POST /stock/qty/batch
 * body: { warehouseId, productIds: string[] }
 * Retourne: { items: [{ productId, quantity }] }
 * Utile pour l'UI multi-lignes (évite de spammer /qty).
 */
exports.stockRouter.post("/qty/batch", async (req, res) => {
    const data = (0, validate_1.validate)(zod_1.z.object({
        warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
        productIds: zod_1.z.array(zod_1.z.string().min(1)).min(1, "productIds requis").max(500, "Trop de produits (max 500)"),
    }), req.body);
    const items = await stock_service_1.stockService.getQtyBatch(data.warehouseId, data.productIds);
    res.json({ items });
});
/**
 * POST /stock/adjustments
 * body: { warehouseId, productId, qtyDelta, note }
 * Corrections (audit) : force kind=ADJUST, refType=CORRECTION
 */
exports.stockRouter.post("/adjustments", async (req, res) => {
    const data = (0, validate_1.validate)(stock_schemas_1.stockAdjustmentCreateSchema, req.body);
    const result = await stock_service_1.stockService.createMove({
        kind: "ADJUST",
        warehouseId: data.warehouseId,
        productId: data.productId,
        qtyDelta: data.qtyDelta,
        refType: "CORRECTION",
        refId: null,
        note: data.note,
    });
    res.status(201).json(result);
});
/**
 * POST /stock/returns
 * body: { warehouseId, productId, qty, reason, note? }
 * Retour client (métier) : force kind=IN, refType=RETURN
 */
exports.stockRouter.post("/returns", async (req, res) => {
    const data = (0, validate_1.validate)(stock_schemas_1.stockReturnCreateSchema, req.body);
    const result = await stock_service_1.stockService.createReturn(data);
    res.status(201).json(result);
});
/**
 * POST /stock/losses
 * body: { warehouseId, productId, qty, type: BREAK|THEFT, note }
 * Casse / vol (métier, rare) : force kind=OUT, refType=LOSS
 */
exports.stockRouter.post("/losses", async (req, res) => {
    const data = (0, validate_1.validate)(stock_schemas_1.stockLossCreateSchema, req.body);
    const result = await stock_service_1.stockService.createLoss(data);
    res.status(201).json(result);
});
/**
 * POST /stock/moves
 * body: { kind, warehouseId, productId, qtyDelta, refType?, refId?, note? }
 */
exports.stockRouter.post("/moves", async (req, res) => {
    const data = (0, validate_1.validate)(stock_schemas_1.stockMoveCreateSchema, req.body);
    const result = await stock_service_1.stockService.createMove(data);
    res.status(201).json(result);
});
/**
 * ⚠️ LEGACY / DANGEREUX
 * POST /stock/inventory
 * Ancien endpoint "set stock" (modifie directement via ADJUST).
 * On le DÉPRÉCIE pour éviter une faille (pas de document, pas d'audit métier).
 */
exports.stockRouter.post("/inventory", async () => {
    throw new errors_1.AppError("Endpoint /stock/inventory déprécié. Utilise /stock/inventories (document d'inventaire) ou /stock/adjustments (correction).", { status: 410, code: errors_1.ERROR_CODES.DEPRECATED });
});
/**
 * LEGACY (temporaire) : si tu dois garder une porte de secours en V1.
 * POST /stock/inventory/legacy
 * body: { warehouseId, productId, countedQty, note }
 */
exports.stockRouter.post("/inventory/legacy", async (req, res) => {
    const data = (0, validate_1.validate)(zod_1.z.object({
        warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
        productId: zod_1.z.string().min(1, "productId requis"),
        countedQty: zod_1.z.coerce.number().int().min(0, "countedQty doit être >= 0"),
        // on force une note pour éviter les ajustements "au piff"
        note: zod_1.z.string().min(3, "note obligatoire"),
    }), req.body);
    const result = await stock_service_1.stockService.setInventory(data);
    res.status(201).json(result);
});
/**
 * POST /stock/transfers
 * body: { fromWarehouseId, toWarehouseId, lines: [{ productId, qty, note? }], note? }
 * Mode unique (ERP) : crée automatiquement un trajet en 2 étapes via l'entrepôt système TRANSIT.
 * - Étape 1 : SOURCE -> TRANSIT (DRAFT)
 * - Étape 2 : TRANSIT -> DESTINATION (DRAFT)
 * Les 2 transferts partagent le même journeyId.
 *
 * ⚠️ Important UX : le front n'a pas à choisir un "mode".
 */
exports.stockRouter.post("/transfers", async (req, res) => {
    const data = (0, validate_1.validate)(stock_schemas_1.stockTransferCreateSchema, req.body);
    const result = await stock_service_1.stockService.createTransferJourney({
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        note: data.note ?? null,
        purpose: data.purpose ?? null,
        lines: data.lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            note: l.note ?? null,
        })),
    });
    res.status(201).json(result);
});
/**
 * POST /stock/transfers/journey
 * Alias interne (debug / scripts). Ne doit pas être utilisé par l'UX standard.
 * L'UX standard doit appeler uniquement POST /stock/transfers.
 */
exports.stockRouter.post("/transfers/journey", async (req, res) => {
    const data = (0, validate_1.validate)(zod_1.z.object({
        fromWarehouseId: zod_1.z.string().min(1),
        toWarehouseId: zod_1.z.string().min(1),
        note: zod_1.z.string().optional().nullable(),
        journeyNote: zod_1.z.string().optional().nullable(),
        purpose: zod_1.z.string().optional().nullable(),
        lines: zod_1.z
            .array(zod_1.z.object({
            productId: zod_1.z.string().min(1),
            qty: zod_1.z.coerce.number().int().positive(),
            note: zod_1.z.string().optional().nullable(),
        }))
            .min(1)
            .max(500),
    }), req.body);
    const result = await stock_service_1.stockService.createTransferJourney({
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        note: data.note ?? data.journeyNote ?? null,
        purpose: data.purpose ?? null,
        lines: data.lines.map(l => ({
            productId: l.productId,
            qty: l.qty,
            note: l.note ?? null,
        })),
    });
    res.status(201).json(result);
});
/**
 * GET /stock/moves?warehouseId=...&limit=50
 * (optionnel V1) derniers mouvements
 */
exports.stockRouter.get("/moves", async (req, res) => {
    const q = (0, validate_1.validate)(zod_1.z.object({
        warehouseId: zod_1.z.string().min(1, "warehouseId requis"),
        limit: zod_1.z.coerce.number().int().positive().max(500).optional().default(50),
    }), {
        warehouseId: String(req.query.warehouseId ?? ""),
        limit: req.query.limit,
    });
    const items = await stock_service_1.stockService.lastMoves(q.warehouseId, q.limit);
    res.json({ items });
});
/**
 * GET /stock/transfers?limit=100
 * Historique transferts (ultra pro: lecture directe de StockTransfer)
 */
exports.stockRouter.get("/transfers", async (req, res) => {
    const q = (0, validate_1.validate)(stock_schemas_1.stockTransfersListQuerySchema, {
        limit: req.query.limit,
    });
    const result = await stock_service_1.stockService.listTransfers(q.limit);
    res.json(result);
});
/**
 * GET /stock/transfers/:id
 * Détail d'un transfert (header + lignes)
 */
exports.stockRouter.get("/transfers/:id", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1, "id requis") }), { id: String(req.params.id ?? "") });
    const result = await stock_service_1.stockService.getTransfer(params.id);
    res.json(result);
});
/**
 * POST /stock/transfers/:id/ship
 * Expédition (décrémente le stock source) — workflow ERP
 */
exports.stockRouter.post("/transfers/:id/ship", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1, "id requis") }), { id: String(req.params.id ?? "") });
    const data = (0, validate_1.validate)(stock_schemas_1.stockTransferShipSchema, req.body);
    const result = await stock_service_1.stockService.shipTransfer(params.id, data);
    res.status(200).json(result);
});
/**
 * POST /stock/transfers/:id/receive
 * Réception (incrémente le stock destination) — support partiel + litiges
 */
exports.stockRouter.post("/transfers/:id/receive", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1, "id requis") }), { id: String(req.params.id ?? "") });
    const data = (0, validate_1.validate)(stock_schemas_1.stockTransferReceiveSchema, req.body);
    const result = await stock_service_1.stockService.receiveTransfer(params.id, data);
    res.status(200).json(result);
});
