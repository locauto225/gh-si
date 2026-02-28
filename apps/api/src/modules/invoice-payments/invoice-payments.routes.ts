import { Router } from "express";
import { validate } from "../../lib/validate";
import { invoicePaymentsService } from "./invoice-payments.service";
import { invoicePaymentParamsSchema, invoicePaymentCreateBodySchema } from "./invoice-payments.schemas";

export const invoicePaymentsRouter = Router();

// GET /invoices/:id/payments
invoicePaymentsRouter.get("/:id/payments", async (req, res) => {
  const p = validate(invoicePaymentParamsSchema, { id: req.params.id });
  const result = await invoicePaymentsService.listForInvoice(p.id);
  return res.json(result);
});

// POST /invoices/:id/payments
invoicePaymentsRouter.post("/:id/payments", async (req, res) => {
  const p = validate(invoicePaymentParamsSchema, { id: req.params.id });
  const body = validate(invoicePaymentCreateBodySchema, req.body);
  const result = await invoicePaymentsService.createForInvoice(p.id, body);
  return res.status(201).json(result);
});