import { Router } from "express";
import { validate } from "../../lib/validate";
import { inventoriesService } from "./inventories.service";
import {
  inventoriesListQuerySchema,
  inventoryCreateSchema,
  inventoryGenerateLinesSchema,
  inventoryLineUpdateSchema,
  inventoryPostSchema,
} from "./inventories.schemas";
import { AppError, ERROR_CODES } from "../../lib/errors";

export const inventoriesRouter = Router();

/**
 * GET /stock/inventories?warehouseId=&status=&limit=
 */
inventoriesRouter.get("/", async (req, res) => {
  const q = validate(inventoriesListQuerySchema, {
    warehouseId: typeof req.query.warehouseId === "string" ? req.query.warehouseId : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    limit: req.query.limit,
  });

  const items = await inventoriesService.list(q);
  res.json({ items });
});

/**
 * GET /stock/inventories/:id
 */
inventoriesRouter.get("/:id", async (req, res) => {
  const item = await inventoriesService.get(req.params.id);
  if (!item) {
    throw new AppError("Inventory not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  res.json({ item });
});

/**
 * POST /stock/inventories
 * body: { warehouseId, mode, categoryId?, note? }
 */
inventoriesRouter.post("/", async (req, res) => {
  const data = validate(inventoryCreateSchema, req.body);
  const item = await inventoriesService.createDraft({
    warehouseId: data.warehouseId,
    mode: data.mode,
    categoryId: data.categoryId ?? null,
    note: data.note ?? null,
  });
  res.status(201).json({ item });
});

/**
 * POST /stock/inventories/:id/generate
 * body: { mode?, categoryId? }
 */
inventoriesRouter.post("/:id/generate", async (req, res) => {
  const data = validate(inventoryGenerateLinesSchema, req.body);
  const result = await inventoriesService.generateLines(req.params.id, {
    mode: (data.mode as any) ?? undefined,
    categoryId: data.categoryId ?? null,
  });
  res.status(201).json(result);
});

/**
 * PATCH /stock/inventories/:id/lines/:lineId
 * body: { countedQty?, status?, note? }
 */
inventoriesRouter.patch("/:id/lines/:lineId", async (req, res) => {
  const data = validate(inventoryLineUpdateSchema, req.body);
  const item = await inventoriesService.updateLine(req.params.id, req.params.lineId, {
    countedQty: data.countedQty,
    status: data.status as any,
    note: data.note ?? null,
  });
  res.json({ item });
});

/**
 * POST /stock/inventories/:id/post
 * body: { note, postedBy? }
 */
inventoriesRouter.post("/:id/post", async (req, res) => {
  const data = validate(inventoryPostSchema, req.body);
  const item = await inventoriesService.post(req.params.id, {
    note: data.note,
    postedBy: data.postedBy ?? null,
  });
  res.status(201).json({ item });
});