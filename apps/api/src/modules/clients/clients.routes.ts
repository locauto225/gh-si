import { Router } from "express";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { clientsService } from "./clients.service";
import {
  clientCreateSchema,
  clientStatusSchema,
  clientUpdateSchema,
  clientsListQuerySchema,
} from "./clients.schemas";

export const clientsRouter = Router();

/**
 * GET /clients?status=active|inactive|all&q=...&limit=...
 */
clientsRouter.get("/", async (req, res) => {
  const q = validate(clientsListQuerySchema, {
    status: req.query.status,
    q: req.query.q,
    limit: req.query.limit,
  });

  const items = await clientsService.list(q);
  res.json({ items });
});

/**
 * GET /clients/:id
 */
clientsRouter.get("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const item = await clientsService.get(p.id);
  res.json({ item });
});

/**
 * POST /clients
 */
clientsRouter.post("/", async (req, res) => {
  const data = validate(clientCreateSchema, req.body);
  const item = await clientsService.create(data);
  res.status(201).json({ item });
});

/**
 * PATCH /clients/:id
 */
clientsRouter.patch("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(clientUpdateSchema, req.body);
  const item = await clientsService.update(p.id, data);
  res.json({ item });
});

/**
 * PATCH /clients/:id/status
 */
clientsRouter.patch("/:id/status", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const data = validate(clientStatusSchema, req.body);
  const item = await clientsService.setStatus(p.id, data.isActive);
  res.json({ item });
});

/**
 * DELETE /clients/:id (soft delete)
 */
clientsRouter.delete("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), req.params);
  const item = await clientsService.remove(p.id);
  res.json({ item });
});