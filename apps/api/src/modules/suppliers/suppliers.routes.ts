import { Router } from "express";
import { z } from "zod";
import { validate } from "../../lib/validate";
import { suppliersService } from "./suppliers.service";
import {
  supplierCreateSchema,
  supplierStatusSchema,
  supplierUpdateSchema,
  suppliersListQuerySchema,
} from "./suppliers.schemas";

export const suppliersRouter = Router();

suppliersRouter.get("/", async (req, res) => {
  const q = validate(suppliersListQuerySchema, {
    status: req.query.status,
    q: req.query.q,
    limit: req.query.limit,
  });

  const items = await suppliersService.list(q);
  res.json({ items });
});

suppliersRouter.get("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), { id: req.params.id });
  const item = await suppliersService.get(p.id);
  res.json({ item });
});

suppliersRouter.post("/", async (req, res) => {
  const data = validate(supplierCreateSchema, req.body);
  const item = await suppliersService.create(data);
  res.status(201).json({ item });
});

suppliersRouter.put("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), { id: req.params.id });
  const data = validate(supplierUpdateSchema, req.body);
  const item = await suppliersService.update(p.id, data);
  res.json({ item });
});

suppliersRouter.patch("/:id/status", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), { id: req.params.id });
  const data = validate(supplierStatusSchema, req.body);
  const item = await suppliersService.setStatus(p.id, data);
  res.json({ item });
});

suppliersRouter.delete("/:id", async (req, res) => {
  const p = validate(z.object({ id: z.string().min(1) }), { id: req.params.id });
  const item = await suppliersService.remove(p.id);
  res.json({ item });
});