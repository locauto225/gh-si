import { Router } from "express";
import { validate } from "../../lib/validate";
import { stopPaymentsService } from "./stop-payments.service";
import {
  stopPaymentCreateSchema,
  stopPaymentIdParamsSchema,
  stopPaymentsListQuerySchema,
} from "./stop-payments.schemas";

export const stopPaymentsRouter = Router();

/**
 * GET /stop-payments?stopId=...&limit=50
 */
stopPaymentsRouter.get("/", async (req, res) => {
  const q = validate(stopPaymentsListQuerySchema, {
    stopId: req.query.stopId ? String(req.query.stopId) : "",
    limit: req.query.limit,
  });

  const result = await stopPaymentsService.list(q);
  res.json(result);
});

/**
 * POST /stop-payments
 * body: { stopId, method, amount, reference?, note?, receivedAt? }
 */
stopPaymentsRouter.post("/", async (req, res) => {
  const data = validate(stopPaymentCreateSchema, req.body);
  const result = await stopPaymentsService.create(data);
  res.status(201).json(result);
});

/**
 * DELETE /stop-payments/:id
 */
stopPaymentsRouter.delete("/:id", async (req, res) => {
  const params = validate(stopPaymentIdParamsSchema, req.params);
  const result = await stopPaymentsService.remove(params.id);
  res.json(result);
});