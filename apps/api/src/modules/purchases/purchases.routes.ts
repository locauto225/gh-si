import { Router } from "express";
import { validate } from "../../lib/validate";
import { purchasesService } from "./purchases.service";
import {
  purchaseCreateSchema,
  purchasesListQuerySchema,
  purchaseReceiveSchema,
  purchaseStatusSchema,
} from "./purchases.schemas";

export const purchasesRouter = Router();

/**
 * GET /purchases?status=...&q=...&limit=...
 */
purchasesRouter.get("/", async (req, res) => {
  const q = validate(purchasesListQuerySchema, {
    status: req.query.status ?? "all",
    q: req.query.q,
    limit: req.query.limit,
  });

  const result = await purchasesService.list(q);
  res.json(result);
});

/**
 * GET /purchases/:id
 */
purchasesRouter.get("/:id", async (req, res) => {
  const result = await purchasesService.get(String(req.params.id));
  res.json(result);
});

/**
 * POST /purchases
 */
purchasesRouter.post("/", async (req, res) => {
  const data = validate(purchaseCreateSchema, req.body);
  const result = await purchasesService.create(data);
  res.status(201).json(result);
});

/**
 * PATCH /purchases/:id/status
 * body: { status }
 */
purchasesRouter.patch("/:id/status", async (req, res) => {
  const data = validate(purchaseStatusSchema, req.body);
  const result = await purchasesService.setStatus(String(req.params.id), data);
  res.json(result);
});

/**
 * POST /purchases/:id/receive
 * body: { note?, lines: [{productId, qtyReceived}] }
 */
purchasesRouter.post("/:id/receive", async (req, res) => {
  const data = validate(purchaseReceiveSchema, req.body);
  const result = await purchasesService.receive(String(req.params.id), data);
  res.status(201).json(result);
});