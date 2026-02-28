"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../lib/validate");
const clients_service_1 = require("./clients.service");
const clients_schemas_1 = require("./clients.schemas");
exports.clientsRouter = (0, express_1.Router)();
/**
 * GET /clients?status=active|inactive|all&q=...&limit=...
 */
exports.clientsRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(clients_schemas_1.clientsListQuerySchema, {
        status: req.query.status,
        q: req.query.q,
        limit: req.query.limit,
    });
    const items = await clients_service_1.clientsService.list(q);
    res.json({ items });
});
/**
 * GET /clients/:id
 */
exports.clientsRouter.get("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const item = await clients_service_1.clientsService.get(p.id);
    res.json({ item });
});
/**
 * POST /clients
 */
exports.clientsRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(clients_schemas_1.clientCreateSchema, req.body);
    const item = await clients_service_1.clientsService.create(data);
    res.status(201).json({ item });
});
/**
 * PATCH /clients/:id
 */
exports.clientsRouter.patch("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(clients_schemas_1.clientUpdateSchema, req.body);
    const item = await clients_service_1.clientsService.update(p.id, data);
    res.json({ item });
});
/**
 * PATCH /clients/:id/status
 */
exports.clientsRouter.patch("/:id/status", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(clients_schemas_1.clientStatusSchema, req.body);
    const item = await clients_service_1.clientsService.setStatus(p.id, data.isActive);
    res.json({ item });
});
/**
 * DELETE /clients/:id (soft delete)
 */
exports.clientsRouter.delete("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const item = await clients_service_1.clientsService.remove(p.id);
    res.json({ item });
});
