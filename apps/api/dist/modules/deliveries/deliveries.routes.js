"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveriesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../lib/validate");
const deliveries_service_1 = require("./deliveries.service");
const deliveries_schemas_1 = require("./deliveries.schemas");
exports.deliveriesRouter = (0, express_1.Router)();
/**
 * GET /deliveries?status=all&limit=50&warehouseId=&driverId=&q=
 */
exports.deliveriesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(deliveries_schemas_1.deliveriesListQuerySchema, {
        limit: req.query.limit,
        status: String(req.query.status ?? "all"),
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        driverId: req.query.driverId ? String(req.query.driverId) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
    });
    const result = await deliveries_service_1.deliveriesService.list(q);
    res.json(result);
});
/**
 * GET /deliveries/available
 * BL disponibles = non affectés (tripId/stopId null)
 * query: ?limit=50&warehouseId=&q=&status=PREPARED
 */
exports.deliveriesRouter.get("/available", async (req, res) => {
    const q = (0, validate_1.validate)(deliveries_schemas_1.deliveriesAvailableQuerySchema, {
        limit: req.query.limit,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
    });
    const result = await deliveries_service_1.deliveriesService.available(q);
    res.json(result);
});
/**
 * GET /deliveries/track/:token (public)
 */
exports.deliveriesRouter.get("/track/:token", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ token: zod_1.z.string().min(6) }), req.params);
    const result = await deliveries_service_1.deliveriesService.trackByToken(params.token);
    res.json(result);
});
/**
 * GET /deliveries/:id
 */
exports.deliveriesRouter.get("/:id", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const result = await deliveries_service_1.deliveriesService.get(params.id);
    res.json(result);
});
/**
 * POST /deliveries/:id/assign
 * body: { tripId?, stopId? }
 */
exports.deliveriesRouter.post("/:id/assign", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(deliveries_schemas_1.deliveryAssignSchema, req.body);
    const result = await deliveries_service_1.deliveriesService.assign(params.id, data);
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
exports.deliveriesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(deliveries_schemas_1.deliveryCreateAnySchema, req.body);
    const result = await deliveries_service_1.deliveriesService.create(data);
    res.status(201).json(result);
});
/**
 * PATCH /deliveries/:id/status
 * body: { status, message? }
 */
exports.deliveriesRouter.patch("/:id/status", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(deliveries_schemas_1.deliverySetStatusSchema, req.body);
    const result = await deliveries_service_1.deliveriesService.setStatus(params.id, data);
    res.json(result);
});
/**
 * POST /deliveries/:id/events
 * body: { type, message?, meta? }
 */
exports.deliveriesRouter.post("/:id/events", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(deliveries_schemas_1.deliveryAddEventSchema, req.body);
    const result = await deliveries_service_1.deliveriesService.addEvent(params.id, data);
    res.status(201).json(result);
});
