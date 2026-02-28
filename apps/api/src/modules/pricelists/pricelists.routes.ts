// apps/api/src/modules/pricelists/pricelists.routes.ts
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../lib/validate";
import {
  pricelistsListQuerySchema,
  priceListCreateSchema,
  priceListUpdateSchema,
  priceListItemCreateSchema,
  priceListItemUpdateSchema,
} from "./pricelists.schemas";
import { pricelistsService } from "./pricelists.service";

export const pricelistsRouter = Router();

/**
 * GET /pricelists?q=...&status=active|inactive|all&limit=50
 */
pricelistsRouter.get("/", async (req, res) => {
  const q = validate(pricelistsListQuerySchema, {
    q: req.query.q,
    status: req.query.status,
    limit: req.query.limit,
  });

  const result = await pricelistsService.list(q);
  res.json(result);
});

/**
 * POST /pricelists
 */
pricelistsRouter.post("/", async (req, res) => {
  const data = validate(priceListCreateSchema, req.body);
  const result = await pricelistsService.create(data);
  res.status(201).json(result);
});

/**
 * GET /pricelists/:id
 */
pricelistsRouter.get("/:id", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const result = await pricelistsService.get(params.id);
  res.json(result);
});

/**
 * PATCH /pricelists/:id
 */
pricelistsRouter.patch("/:id", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(priceListUpdateSchema, req.body);
  const result = await pricelistsService.update(params.id, data);
  res.json(result);
});

/**
 * POST /pricelists/:id/items
 * body: { productId, unitPrice }
 * (upsert)
 */
pricelistsRouter.post("/:id/items", async (req, res) => {
  const params = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(priceListItemCreateSchema, req.body);
  const result = await pricelistsService.addItem(params.id, data);
  res.status(201).json(result);
});

/**
 * PATCH /pricelists/:id/items/:itemId
 * body: { unitPrice }
 */
pricelistsRouter.patch("/:id/items/:itemId", async (req, res) => {
  const params = validate(
    z.object({ id: z.string().min(1), itemId: z.string().min(1) }),
    req.params
  );
  const data = validate(priceListItemUpdateSchema, req.body);
  const result = await pricelistsService.updateItem(params.id, params.itemId, data);
  res.json(result);
});

/**
 * DELETE /pricelists/:id/items/:itemId
 */
pricelistsRouter.delete("/:id/items/:itemId", async (req, res) => {
  const params = validate(
    z.object({ id: z.string().min(1), itemId: z.string().min(1) }),
    req.params
  );

  const result = await pricelistsService.deleteItem(params.id, params.itemId);
  res.json(result);
});