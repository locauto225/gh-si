"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicePaymentsRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const invoice_payments_service_1 = require("./invoice-payments.service");
const invoice_payments_schemas_1 = require("./invoice-payments.schemas");
exports.invoicePaymentsRouter = (0, express_1.Router)();
// GET /invoices/:id/payments
exports.invoicePaymentsRouter.get("/:id/payments", async (req, res) => {
    const p = (0, validate_1.validate)(invoice_payments_schemas_1.invoicePaymentParamsSchema, { id: req.params.id });
    const result = await invoice_payments_service_1.invoicePaymentsService.listForInvoice(p.id);
    return res.json(result);
});
// POST /invoices/:id/payments
exports.invoicePaymentsRouter.post("/:id/payments", async (req, res) => {
    const p = (0, validate_1.validate)(invoice_payments_schemas_1.invoicePaymentParamsSchema, { id: req.params.id });
    const body = (0, validate_1.validate)(invoice_payments_schemas_1.invoicePaymentCreateBodySchema, req.body);
    const result = await invoice_payments_service_1.invoicePaymentsService.createForInvoice(p.id, body);
    return res.status(201).json(result);
});
