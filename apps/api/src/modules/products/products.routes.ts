import { Router } from "express";
import { validate } from "../../lib/validate";
import { AppError, ERROR_CODES } from "../../lib/errors";
import { productCreateSchema, productUpdateSchema } from "./products.schemas";
import { z } from "zod";
import { productsService } from "./products.service";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const querySchema = z.object({
    status: z.string().optional(),
    q: z.string().optional(),
    categoryId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  });

  const q = validate(querySchema, req.query);

  const statusRaw = q.status ?? "active";
  const status =
    statusRaw === "all" || statusRaw === "inactive" || statusRaw === "active" ? statusRaw : "active";

  const items = await (productsService as any).list({
    status,
    q: q.q?.trim() ? q.q.trim() : undefined,
    categoryId: q.categoryId?.trim() ? q.categoryId.trim() : undefined,
    limit: typeof q.limit === "number" ? q.limit : undefined,
  });

  res.json({ items });
});

productsRouter.get("/:id", async (req, res) => {
  const item = await productsService.get(req.params.id);
  if (!item) throw new AppError("Product not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  res.json({ item });
});

productsRouter.post("/", async (req, res) => {
  const data = validate(productCreateSchema, req.body);
  const item = await productsService.create(data);
  res.status(201).json({ item });
});

productsRouter.put("/:id", async (req, res) => {
  const data = validate(productUpdateSchema, req.body);
  const item = await productsService.update(req.params.id, data);
  res.json({ item });
});

const productStatusSchema = z.object({
  isActive: z.boolean(),
});

productsRouter.patch("/:id/status", async (req, res) => {
  const data = validate(productStatusSchema, req.body);
  const item = await productsService.setStatus(req.params.id, data.isActive);
  res.json({ item });
});

productsRouter.delete("/:id", async (req, res) => {
  const item = await productsService.remove(req.params.id);
  res.json({ item });
});