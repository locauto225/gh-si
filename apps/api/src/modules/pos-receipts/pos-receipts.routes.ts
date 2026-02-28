import { Router } from "express";
import { validate } from "../../lib/validate";
import { posReceiptsService } from "./pos-receipts.service";
import {
  posReceiptIdSchema,
  posReceiptsListQuerySchema,
} from "./pos-receipts.schemas";

export const posReceiptsRouter = Router();

// GET /pos/receipts?storeId=...&limit=...
posReceiptsRouter.get("/", async (req, res) => {
  const q = validate(posReceiptsListQuerySchema, {
    storeId: req.query.storeId,
    limit: req.query.limit,
  });

  const result = await posReceiptsService.list(q);
  return res.json(result); // { items: [...] }
});

// GET /pos/receipts/:id
posReceiptsRouter.get("/:id", async (req, res) => {
  const p = validate(posReceiptIdSchema, { id: req.params.id });
  const result = await posReceiptsService.get(p.id);
  return res.json(result); // { item }
});