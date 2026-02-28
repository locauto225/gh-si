import { Router } from "express";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { deliveriesService } from "./deliveries.service";
import {
  deliveriesListQuerySchema,
  deliveriesAvailableQuerySchema,
  deliveryAddEventSchema,
  deliveryAssignSchema,
  deliveryCreateAnySchema,
  deliverySetStatusSchema,
} from "./deliveries.schemas";

export const deliveriesRouter = Router();

/**
 * GET /deliveries?status=all&limit=50&warehouseId=&driverId=&q=
 */
deliveriesRouter.get("/", async (req, res) => {
  const q = validate(deliveriesListQuerySchema, {
    limit: req.query.limit,
    status: String(req.query.status ?? "all"),
    warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
    driverId: req.query.driverId ? String(req.query.driverId) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
  });

  const result = await deliveriesService.list(q);
  res.json(result);
});

/**
 * GET /deliveries/available
 * BL disponibles = non affectés (tripId/stopId null)
 * query: ?limit=50&warehouseId=&q=&status=PREPARED
 */
deliveriesRouter.get("/available", async (req, res) => {
  const q = validate(deliveriesAvailableQuerySchema, {
    limit: req.query.limit,
    warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });

  const result = await deliveriesService.available(q);
  res.json(result);
});

/**
 * GET /deliveries/track/:token (public)
 */
deliveriesRouter.get("/track/:token", async (req, res) => {
  const params = validate(z.object({ token: z.string().min(6) }), req.params);
  const result = await deliveriesService.trackByToken(params.token);
  res.json(result);
});

/**
 * GET /deliveries/:id
 */
deliveriesRouter.get("/:id", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const result = await deliveriesService.get(params.id);
  res.json(result);
});

/**
 * POST /deliveries/:id/assign
 * body: { tripId?, stopId? }
 */
deliveriesRouter.post("/:id/assign", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(deliveryAssignSchema, req.body);
  const result = await deliveriesService.assign(params.id, data);
  res.status(200).json(result);
});

/**
 * POST /deliveries
 *
 * Accepte 3 shapes (sale / order / internal) :
 *
 * 1) BL depuis une vente
 * body: {
 *   saleId: string,
 *   driverId?: string,
 *   transferId?: string,
 *   note?: string,
 *   lines: Array<{ saleLineId: string; qtyDelivered: number; note?: string }>
 * }
 *
 * 2) BL hors vente (interne)
 * body: {
 *   fromWarehouseId: string,
 *   toWarehouseId?: string,
 *   toStoreId?: string,
 *   driverId?: string,
 *   transferId?: string,
 *   transferPurpose?: string,
 *   note?: string,
 *   lines: Array<{ productId: string; qty: number; note?: string }>
 * }
 */
deliveriesRouter.post("/", async (req, res) => {
  const data = validate(deliveryCreateAnySchema, req.body);
  const result = await deliveriesService.create(data);
  res.status(201).json(result);
});

/**
 * PATCH /deliveries/:id/status
 * body: { status, message? }
 */
deliveriesRouter.patch("/:id/status", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(deliverySetStatusSchema, req.body);
  const result = await deliveriesService.setStatus(params.id, data);
  res.json(result);
});

/**
 * POST /deliveries/:id/events
 * body: { type, message?, meta? }
 */
deliveriesRouter.post("/:id/events", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(deliveryAddEventSchema, req.body);
  const result = await deliveriesService.addEvent(params.id, data);
  res.status(201).json(result);
});
