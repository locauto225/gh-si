import { Router } from "express";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { storesService } from "./stores.service";
import { storeCreateSchema, storeSetStatusSchema, storesListQuerySchema, storeUpdateSchema } from "./stores.schemas";

export const storesRouter = Router();

/**
 * GET /stores?status=active|inactive|all&q=...&limit=...
 */
storesRouter.get("/", async (req, res) => {
  const q = validate(storesListQuerySchema, {
    status: String(req.query.status ?? "active"),
    q: req.query.q,
    limit: req.query.limit,
  });

  const result = await storesService.list(q);
  res.json(result);
});

/**
 * GET /stores/list?status=active|inactive|all&q=...&limit=...
 * (léger pour autocomplete)
 */
storesRouter.get("/list", async (req, res) => {
  const q = validate(
    z.object({
      status: z.enum(["active", "inactive", "all"]).default("active"),
      q: z.string().trim().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
    {
      status: String(req.query.status ?? "active"),
      q: req.query.q,
      limit: req.query.limit,
    }
  );

  const result = await storesService.listLight(q);
  res.json(result);
});


/**
 * GET /stores/:id
 */
storesRouter.get("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const result = await storesService.get(p.id);
  res.json(result);
});

/**
 * POST /stores
 */
storesRouter.post("/", async (req, res) => {
  const data = validate(storeCreateSchema, req.body);
  const result = await storesService.create(data);
  res.status(201).json(result);
});

/**
 * PATCH /stores/:id
 */
storesRouter.patch("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(storeUpdateSchema, req.body);
  const result = await storesService.update(p.id, data);
  res.json(result);
});

/**
 * PATCH /stores/:id/status
 * body: { isActive: boolean }
 */
storesRouter.patch("/:id/status", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(storeSetStatusSchema, req.body);
  const result = await storesService.setStatus(p.id, data);
  res.json(result);
});

/**
 * DELETE /stores/:id (soft delete)
 */
storesRouter.delete("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const result = await storesService.remove(p.id);
  res.json(result);
});