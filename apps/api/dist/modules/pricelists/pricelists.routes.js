"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricelistsRouter = void 0;
// apps/api/src/modules/pricelists/pricelists.routes.ts
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../lib/validate");
const pricelists_schemas_1 = require("./pricelists.schemas");
const pricelists_service_1 = require("./pricelists.service");
exports.pricelistsRouter = (0, express_1.Router)();
/**
 * GET /pricelists?q=...&status=active|inactive|all&limit=50
 */
exports.pricelistsRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(pricelists_schemas_1.pricelistsListQuerySchema, {
        q: req.query.q,
        status: req.query.status,
        limit: req.query.limit,
    });
    const result = await pricelists_service_1.pricelistsService.list(q);
    res.json(result);
});
/**
 * POST /pricelists
 */
exports.pricelistsRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(pricelists_schemas_1.priceListCreateSchema, req.body);
    const result = await pricelists_service_1.pricelistsService.create(data);
    res.status(201).json(result);
});
/**
 * GET /pricelists/:id
 */
exports.pricelistsRouter.get("/:id", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const result = await pricelists_service_1.pricelistsService.get(params.id);
    res.json(result);
});
/**
 * PATCH /pricelists/:id
 */
exports.pricelistsRouter.patch("/:id", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(pricelists_schemas_1.priceListUpdateSchema, req.body);
    const result = await pricelists_service_1.pricelistsService.update(params.id, data);
    res.json(result);
});
/**
 * POST /pricelists/:id/items
 * body: { productId, unitPrice }
 * (upsert)
 */
exports.pricelistsRouter.post("/:id/items", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(pricelists_schemas_1.priceListItemCreateSchema, req.body);
    const result = await pricelists_service_1.pricelistsService.addItem(params.id, data);
    res.status(201).json(result);
});
/**
 * PATCH /pricelists/:id/items/:itemId
 * body: { unitPrice }
 */
exports.pricelistsRouter.patch("/:id/items/:itemId", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1), itemId: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(pricelists_schemas_1.priceListItemUpdateSchema, req.body);
    const result = await pricelists_service_1.pricelistsService.updateItem(params.id, params.itemId, data);
    res.json(result);
});
/**
 * DELETE /pricelists/:id/items/:itemId
 */
exports.pricelistsRouter.delete("/:id/items/:itemId", async (req, res) => {
    const params = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1), itemId: zod_1.z.string().min(1) }), req.params);
    const result = await pricelists_service_1.pricelistsService.deleteItem(params.id, params.itemId);
    res.json(result);
});
