import { Router } from "express";
import { validate } from "../../lib/validate";
import {
  warehouseCreateSchema,
  warehouseStatusSchema,
  warehouseUpdateSchema,
  warehousesListQuerySchema,
} from "./warehouses.schemas";
import { warehousesService } from "./warehouses.service";
import { AppError, ERROR_CODES } from "../../lib/errors";

export const warehousesRouter = Router();

// GET /warehouses?status=active|inactive|all&kind=DEPOT|STORE|all&q=...&limit=...
warehousesRouter.get("/", async (req, res) => {
  const q = validate(warehousesListQuerySchema, {
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    kind: typeof req.query.kind === "string" ? req.query.kind : undefined,
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
  });

  const items = await warehousesService.list(q);
  res.json({ items });
});

// GET /warehouses/:id
warehousesRouter.get("/:id", async (req, res) => {
  const item = await warehousesService.get(req.params.id);
  if (!item) throw new AppError("Warehouse not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  res.json({ item });
});

// POST /warehouses
warehousesRouter.post("/", async (req, res) => {
  const data = validate(warehouseCreateSchema, req.body);
  const item = await warehousesService.create(data);
  res.status(201).json({ item });
});

// PATCH /warehouses/:id
warehousesRouter.patch("/:id", async (req, res) => {
  const data = validate(warehouseUpdateSchema, req.body);
  const item = await warehousesService.update(req.params.id, data);
  res.json({ item });
});

// PATCH /warehouses/:id/status
warehousesRouter.patch("/:id/status", async (req, res) => {
  const data = validate(warehouseStatusSchema, req.body);
  const item = await warehousesService.setStatus(req.params.id, data.isActive);
  res.json({ item });
});

// DELETE /warehouses/:id (soft delete)
warehousesRouter.delete("/:id", async (req, res) => {
  const item = await warehousesService.remove(req.params.id);
  res.json({ item });
});