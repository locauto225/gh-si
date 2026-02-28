import { Router } from "express";
import { validate } from "../../lib/validate";
import { saleCreateSchema, salesListQuerySchema, saleSetStatusSchema } from "./sales.schemas";
import { salesService } from "./sales.service";

export const salesRouter = Router();

/**
 * GET /sales?status=...&warehouseId=...&storeId=...&q=...&limit=...
 */
salesRouter.get("/", async (req, res) => {
  const q = validate(salesListQuerySchema, {
    status: String(req.query.status ?? "all"),
    warehouseId: req.query.warehouseId,
    storeId: req.query.storeId,
    q: req.query.q,
    limit: req.query.limit,
  });

  const result = await salesService.list(q);
  res.json(result);
});

/**
 * GET /sales/:id
 */
salesRouter.get("/:id", async (req, res) => {
  const result = await salesService.get(String(req.params.id));
  res.json(result);
});

/**
 * POST /sales/quote
 * body: same as POST /sales (warehouseId/storeId/clientId/note/lines)
 * Returns computed unit prices + totals WITHOUT creating a sale.
 */
salesRouter.post("/quote", async (req, res) => {
  const data = validate(saleCreateSchema, req.body);

  const quoteFn = (salesService as any).quote;
  if (typeof quoteFn !== "function") {
    return res.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "salesService.quote() n’est pas encore implémenté.",
      },
    });
  }

  const result = await quoteFn(data);
  res.json(result);
});

/**
 * POST /sales
 */
salesRouter.post("/", async (req, res) => {
  const data = validate(saleCreateSchema, req.body);
  const result = await salesService.create(data);
  res.status(201).json(result);
});

/**
 * PATCH /sales/:id/status
 * body: { status: "POSTED" | "CANCELLED" }
 */
salesRouter.patch("/:id/status", async (req, res) => {
  const data = validate(saleSetStatusSchema, req.body);
  const result = await salesService.setStatus(String(req.params.id), data);
  res.json(result);
});