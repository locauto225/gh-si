"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehousesRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const warehouses_schemas_1 = require("./warehouses.schemas");
const warehouses_service_1 = require("./warehouses.service");
const errors_1 = require("../../lib/errors");
exports.warehousesRouter = (0, express_1.Router)();
// GET /warehouses?status=active|inactive|all&kind=DEPOT|STORE|all&q=...&limit=...
exports.warehousesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(warehouses_schemas_1.warehousesListQuerySchema, {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        kind: typeof req.query.kind === "string" ? req.query.kind : undefined,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
    });
    const items = await warehouses_service_1.warehousesService.list(q);
    res.json({ items });
});
// GET /warehouses/:id
exports.warehousesRouter.get("/:id", async (req, res) => {
    const item = await warehouses_service_1.warehousesService.get(req.params.id);
    if (!item)
        throw new errors_1.AppError("Warehouse not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    res.json({ item });
});
// POST /warehouses
exports.warehousesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(warehouses_schemas_1.warehouseCreateSchema, req.body);
    const item = await warehouses_service_1.warehousesService.create(data);
    res.status(201).json({ item });
});
// PATCH /warehouses/:id
exports.warehousesRouter.patch("/:id", async (req, res) => {
    const data = (0, validate_1.validate)(warehouses_schemas_1.warehouseUpdateSchema, req.body);
    const item = await warehouses_service_1.warehousesService.update(req.params.id, data);
    res.json({ item });
});
// PATCH /warehouses/:id/status
exports.warehousesRouter.patch("/:id/status", async (req, res) => {
    const data = (0, validate_1.validate)(warehouses_schemas_1.warehouseStatusSchema, req.body);
    const item = await warehouses_service_1.warehousesService.setStatus(req.params.id, data.isActive);
    res.json({ item });
});
// DELETE /warehouses/:id (soft delete)
exports.warehousesRouter.delete("/:id", async (req, res) => {
    const item = await warehouses_service_1.warehousesService.remove(req.params.id);
    res.json({ item });
});
