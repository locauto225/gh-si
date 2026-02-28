import { Router } from "express";
import { z } from "zod";
import {
  stockAdjustmentCreateSchema,
  stockListQuerySchema,
  stockLossCreateSchema,
  stockMoveCreateSchema,
  stockReturnCreateSchema,
  stockTransferCreateSchema,
  stockTransferShipSchema,
  stockTransferReceiveSchema,
  stockTransfersListQuerySchema,
} from "./stock.schemas";
import { stockService } from "./stock.service";
import { validate } from "../../lib/validate";
import { AppError, ERROR_CODES } from "../../lib/errors";

export const stockRouter = Router();


/**
 * GET /stock?warehouseId=...
 * Retourne: [{ product, quantity }]
 */
stockRouter.get("/", async (req, res) => {
  const q = validate(stockListQuerySchema, {
    warehouseId: String(req.query.warehouseId ?? ""),
  });

  const items = await stockService.listByWarehouse(q.warehouseId);
  res.json({ items });
});

/**
 * GET /stock/qty?warehouseId=...&productId=...
 * Retourne: { quantity }
 */
stockRouter.get("/qty", async (req, res) => {
  const q = validate(
    z.object({
      warehouseId: z.string().min(1, "warehouseId requis"),
      productId: z.string().min(1, "productId requis"),
    }),
    {
      warehouseId: String(req.query.warehouseId ?? ""),
      productId: String(req.query.productId ?? ""),
    }
  );

  const quantity = await stockService.getQty(q.warehouseId, q.productId);
  res.json({ quantity });
});

/**
 * POST /stock/qty/batch
 * body: { warehouseId, productIds: string[] }
 * Retourne: { items: [{ productId, quantity }] }
 * Utile pour l'UI multi-lignes (évite de spammer /qty).
 */
stockRouter.post("/qty/batch", async (req, res) => {
  const data = validate(
    z.object({
      warehouseId: z.string().min(1, "warehouseId requis"),
      productIds: z.array(z.string().min(1)).min(1, "productIds requis").max(500, "Trop de produits (max 500)"),
    }),
    req.body
  );

  const items = await stockService.getQtyBatch(data.warehouseId, data.productIds);
  res.json({ items });
});

/**
 * POST /stock/adjustments
 * body: { warehouseId, productId, qtyDelta, note }
 * Corrections (audit) : force kind=ADJUST, refType=CORRECTION
 */
stockRouter.post("/adjustments", async (req, res) => {
  const data = validate(stockAdjustmentCreateSchema, req.body);

  const result = await stockService.createMove({
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
stockRouter.post("/returns", async (req, res) => {
  const data = validate(stockReturnCreateSchema, req.body);

  const result = await stockService.createReturn(data);

  res.status(201).json(result);
});

/**
 * POST /stock/losses
 * body: { warehouseId, productId, qty, type: BREAK|THEFT, note }
 * Casse / vol (métier, rare) : force kind=OUT, refType=LOSS
 */
stockRouter.post("/losses", async (req, res) => {
  const data = validate(stockLossCreateSchema, req.body);

  const result = await stockService.createLoss(data);

  res.status(201).json(result);
});

/**
 * POST /stock/moves
 * body: { kind, warehouseId, productId, qtyDelta, refType?, refId?, note? }
 */
stockRouter.post("/moves", async (req, res) => {
  const data = validate(stockMoveCreateSchema, req.body);
  const result = await stockService.createMove(data);
  res.status(201).json(result);
});

/**
 * ⚠️ LEGACY / DANGEREUX
 * POST /stock/inventory
 * Ancien endpoint "set stock" (modifie directement via ADJUST).
 * On le DÉPRÉCIE pour éviter une faille (pas de document, pas d'audit métier).
 */
stockRouter.post("/inventory", async () => {
  throw new AppError(
    "Endpoint /stock/inventory déprécié. Utilise /stock/inventories (document d'inventaire) ou /stock/adjustments (correction).",
    { status: 410, code: ERROR_CODES.DEPRECATED }
  );
});

/**
 * LEGACY (temporaire) : si tu dois garder une porte de secours en V1.
 * POST /stock/inventory/legacy
 * body: { warehouseId, productId, countedQty, note }
 */
stockRouter.post("/inventory/legacy", async (req, res) => {
  const data = validate(
    z.object({
      warehouseId: z.string().min(1, "warehouseId requis"),
      productId: z.string().min(1, "productId requis"),
      countedQty: z.coerce.number().int().min(0, "countedQty doit être >= 0"),
      // on force une note pour éviter les ajustements "au piff"
      note: z.string().min(3, "note obligatoire"),
    }),
    req.body
  );
  const result = await stockService.setInventory(data);
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
stockRouter.post("/transfers", async (req, res) => {
  const data = validate(stockTransferCreateSchema, req.body);

  const result = await stockService.createTransferJourney({
    fromWarehouseId: data.fromWarehouseId,
    toWarehouseId: data.toWarehouseId,
    note: (data as any).note ?? null,
    purpose: (data as any).purpose ?? null,
    lines: (data as any).lines.map((l: any) => ({
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
stockRouter.post("/transfers/journey", async (req, res) => {
  const data = validate(
    z.object({
      fromWarehouseId: z.string().min(1),
      toWarehouseId: z.string().min(1),
      note: z.string().optional().nullable(),
      journeyNote: z.string().optional().nullable(),
      purpose: z.string().optional().nullable(),
      lines: z
        .array(
          z.object({
            productId: z.string().min(1),
            qty: z.coerce.number().int().positive(),
            note: z.string().optional().nullable(),
          })
        )
        .min(1)
        .max(500),
    }),
    req.body
  );
  const result = await stockService.createTransferJourney({
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
stockRouter.get("/moves", async (req, res) => {
  const q = validate(
    z.object({
      warehouseId: z.string().min(1, "warehouseId requis"),
      limit: z.coerce.number().int().positive().max(500).optional().default(50),
    }),
    {
      warehouseId: String(req.query.warehouseId ?? ""),
      limit: req.query.limit,
    }
  );

  const items = await stockService.lastMoves(q.warehouseId, q.limit);
  res.json({ items });
});

/**
 * GET /stock/transfers?limit=100
 * Historique transferts (ultra pro: lecture directe de StockTransfer)
 */
stockRouter.get("/transfers", async (req, res) => {
  const q = validate(stockTransfersListQuerySchema, {
    limit: req.query.limit,
  });

  const result = await stockService.listTransfers(q.limit);
  res.json(result);
});

/**
 * GET /stock/transfers/:id
 * Détail d'un transfert (header + lignes)
 */
stockRouter.get("/transfers/:id", async (req, res) => {
  const params = validate(
    z.object({ id: z.string().min(1, "id requis") }),
    { id: String(req.params.id ?? "") }
  );

  const result = await stockService.getTransfer(params.id);
  res.json(result);
});

/**
 * POST /stock/transfers/:id/ship
 * Expédition (décrémente le stock source) — workflow ERP
 */
stockRouter.post("/transfers/:id/ship", async (req, res) => {
  const params = validate(
    z.object({ id: z.string().min(1, "id requis") }),
    { id: String(req.params.id ?? "") }
  );

  const data = validate(stockTransferShipSchema, req.body);

  const result = await stockService.shipTransfer(params.id, data);
  res.status(200).json(result);
});

/**
 * POST /stock/transfers/:id/receive
 * Réception (incrémente le stock destination) — support partiel + litiges
 */
stockRouter.post("/transfers/:id/receive", async (req, res) => {
  const params = validate(
    z.object({ id: z.string().min(1, "id requis") }),
    { id: String(req.params.id ?? "") }
  );

  const data = validate(stockTransferReceiveSchema, req.body);

  const result = await stockService.receiveTransfer(params.id, data);
  res.status(200).json(result);
});
