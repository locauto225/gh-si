"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchasesRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const purchases_service_1 = require("./purchases.service");
const purchases_schemas_1 = require("./purchases.schemas");
exports.purchasesRouter = (0, express_1.Router)();
/**
 * GET /purchases?status=...&q=...&limit=...
 */
exports.purchasesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(purchases_schemas_1.purchasesListQuerySchema, {
        status: req.query.status ?? "all",
        q: req.query.q,
        limit: req.query.limit,
    });
    const result = await purchases_service_1.purchasesService.list(q);
    res.json(result);
});
/**
 * GET /purchases/:id
 */
exports.purchasesRouter.get("/:id", async (req, res) => {
    const result = await purchases_service_1.purchasesService.get(String(req.params.id));
    res.json(result);
});
/**
 * POST /purchases
 */
exports.purchasesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(purchases_schemas_1.purchaseCreateSchema, req.body);
    const result = await purchases_service_1.purchasesService.create(data);
    res.status(201).json(result);
});
/**
 * PATCH /purchases/:id/status
 * body: { status }
 */
exports.purchasesRouter.patch("/:id/status", async (req, res) => {
    const data = (0, validate_1.validate)(purchases_schemas_1.purchaseStatusSchema, req.body);
    const result = await purchases_service_1.purchasesService.setStatus(String(req.params.id), data);
    res.json(result);
});
/**
 * POST /purchases/:id/receive
 * body: { note?, lines: [{productId, qtyReceived}] }
 */
exports.purchasesRouter.post("/:id/receive", async (req, res) => {
    const data = (0, validate_1.validate)(purchases_schemas_1.purchaseReceiveSchema, req.body);
    const result = await purchases_service_1.purchasesService.receive(String(req.params.id), data);
    res.status(201).json(result);
});
