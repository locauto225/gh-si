"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopPaymentsRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const stop_payments_service_1 = require("./stop-payments.service");
const stop_payments_schemas_1 = require("./stop-payments.schemas");
exports.stopPaymentsRouter = (0, express_1.Router)();
/**
 * GET /stop-payments?stopId=...&limit=50
 */
exports.stopPaymentsRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(stop_payments_schemas_1.stopPaymentsListQuerySchema, {
        stopId: req.query.stopId ? String(req.query.stopId) : "",
        limit: req.query.limit,
    });
    const result = await stop_payments_service_1.stopPaymentsService.list(q);
    res.json(result);
});
/**
 * POST /stop-payments
 * body: { stopId, method, amount, reference?, note?, receivedAt? }
 */
exports.stopPaymentsRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(stop_payments_schemas_1.stopPaymentCreateSchema, req.body);
    const result = await stop_payments_service_1.stopPaymentsService.create(data);
    res.status(201).json(result);
});
/**
 * DELETE /stop-payments/:id
 */
exports.stopPaymentsRouter.delete("/:id", async (req, res) => {
    const params = (0, validate_1.validate)(stop_payments_schemas_1.stopPaymentIdParamsSchema, req.params);
    const result = await stop_payments_service_1.stopPaymentsService.remove(params.id);
    res.json(result);
});
