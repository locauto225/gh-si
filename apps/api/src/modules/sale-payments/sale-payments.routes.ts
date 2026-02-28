import { Router } from "express";
import { validate } from "../../lib/validate";
import { salePaymentsService } from "./sale-payments.service";
import { salePaymentParamsSchema, salePaymentCreateBodySchema } from "./sale-payments.schemas";

export const salePaymentsRouter = Router();

// GET /sales/:id/payments
salePaymentsRouter.get("/:id/payments", async (req, res) => {
  const p = validate(salePaymentParamsSchema, { id: req.params.id });
  const result = await salePaymentsService.listForSale(p.id);
  return res.json(result);
});

// POST /sales/:id/payments
salePaymentsRouter.post("/:id/payments", async (req, res) => {
  const p = validate(salePaymentParamsSchema, { id: req.params.id });
  const body = validate(salePaymentCreateBodySchema, req.body);
  const result = await salePaymentsService.createForSale(p.id, body);
  return res.status(201).json(result);
});