"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salePaymentsRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const sale_payments_service_1 = require("./sale-payments.service");
const sale_payments_schemas_1 = require("./sale-payments.schemas");
exports.salePaymentsRouter = (0, express_1.Router)();
// GET /sales/:id/payments
exports.salePaymentsRouter.get("/:id/payments", async (req, res) => {
    const p = (0, validate_1.validate)(sale_payments_schemas_1.salePaymentParamsSchema, { id: req.params.id });
    const result = await sale_payments_service_1.salePaymentsService.listForSale(p.id);
    return res.json(result);
});
// POST /sales/:id/payments
exports.salePaymentsRouter.post("/:id/payments", async (req, res) => {
    const p = (0, validate_1.validate)(sale_payments_schemas_1.salePaymentParamsSchema, { id: req.params.id });
    const body = (0, validate_1.validate)(sale_payments_schemas_1.salePaymentCreateBodySchema, req.body);
    const result = await sale_payments_service_1.salePaymentsService.createForSale(p.id, body);
    return res.status(201).json(result);
});
