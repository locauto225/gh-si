"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../lib/validate");
const stores_service_1 = require("./stores.service");
const stores_schemas_1 = require("./stores.schemas");
exports.storesRouter = (0, express_1.Router)();
/**
 * GET /stores?status=active|inactive|all&q=...&limit=...
 */
exports.storesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(stores_schemas_1.storesListQuerySchema, {
        status: String(req.query.status ?? "active"),
        q: req.query.q,
        limit: req.query.limit,
    });
    const result = await stores_service_1.storesService.list(q);
    res.json(result);
});
/**
 * GET /stores/list?status=active|inactive|all&q=...&limit=...
 * (léger pour autocomplete)
 */
exports.storesRouter.get("/list", async (req, res) => {
    const q = (0, validate_1.validate)(zod_1.z.object({
        status: zod_1.z.enum(["active", "inactive", "all"]).default("active"),
        q: zod_1.z.string().trim().min(1).optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    }), {
        status: String(req.query.status ?? "active"),
        q: req.query.q,
        limit: req.query.limit,
    });
    const result = await stores_service_1.storesService.listLight(q);
    res.json(result);
});
/**
 * GET /stores/:id
 */
exports.storesRouter.get("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const result = await stores_service_1.storesService.get(p.id);
    res.json(result);
});
/**
 * POST /stores
 */
exports.storesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(stores_schemas_1.storeCreateSchema, req.body);
    const result = await stores_service_1.storesService.create(data);
    res.status(201).json(result);
});
/**
 * PATCH /stores/:id
 */
exports.storesRouter.patch("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(stores_schemas_1.storeUpdateSchema, req.body);
    const result = await stores_service_1.storesService.update(p.id, data);
    res.json(result);
});
/**
 * PATCH /stores/:id/status
 * body: { isActive: boolean }
 */
exports.storesRouter.patch("/:id/status", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const data = (0, validate_1.validate)(stores_schemas_1.storeSetStatusSchema, req.body);
    const result = await stores_service_1.storesService.setStatus(p.id, data);
    res.json(result);
});
/**
 * DELETE /stores/:id (soft delete)
 */
exports.storesRouter.delete("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), req.params);
    const result = await stores_service_1.storesService.remove(p.id);
    res.json(result);
});
