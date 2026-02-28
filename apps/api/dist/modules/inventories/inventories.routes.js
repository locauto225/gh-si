"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoriesRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const inventories_service_1 = require("./inventories.service");
const inventories_schemas_1 = require("./inventories.schemas");
const errors_1 = require("../../lib/errors");
exports.inventoriesRouter = (0, express_1.Router)();
/**
 * GET /stock/inventories?warehouseId=&status=&limit=
 */
exports.inventoriesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(inventories_schemas_1.inventoriesListQuerySchema, {
        warehouseId: typeof req.query.warehouseId === "string" ? req.query.warehouseId : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        limit: req.query.limit,
    });
    const items = await inventories_service_1.inventoriesService.list(q);
    res.json({ items });
});
/**
 * GET /stock/inventories/:id
 */
exports.inventoriesRouter.get("/:id", async (req, res) => {
    const item = await inventories_service_1.inventoriesService.get(req.params.id);
    if (!item) {
        throw new errors_1.AppError("Inventory not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    res.json({ item });
});
/**
 * POST /stock/inventories
 * body: { warehouseId, mode, categoryId?, note? }
 */
exports.inventoriesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(inventories_schemas_1.inventoryCreateSchema, req.body);
    const item = await inventories_service_1.inventoriesService.createDraft({
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
exports.inventoriesRouter.post("/:id/generate", async (req, res) => {
    const data = (0, validate_1.validate)(inventories_schemas_1.inventoryGenerateLinesSchema, req.body);
    const result = await inventories_service_1.inventoriesService.generateLines(req.params.id, {
        mode: data.mode ?? undefined,
        categoryId: data.categoryId ?? null,
    });
    res.status(201).json(result);
});
/**
 * PATCH /stock/inventories/:id/lines/:lineId
 * body: { countedQty?, status?, note? }
 */
exports.inventoriesRouter.patch("/:id/lines/:lineId", async (req, res) => {
    const data = (0, validate_1.validate)(inventories_schemas_1.inventoryLineUpdateSchema, req.body);
    const item = await inventories_service_1.inventoriesService.updateLine(req.params.id, req.params.lineId, {
        countedQty: data.countedQty,
        status: data.status,
        note: data.note ?? null,
    });
    res.json({ item });
});
/**
 * POST /stock/inventories/:id/post
 * body: { note, postedBy? }
 */
exports.inventoriesRouter.post("/:id/post", async (req, res) => {
    const data = (0, validate_1.validate)(inventories_schemas_1.inventoryPostSchema, req.body);
    const item = await inventories_service_1.inventoriesService.post(req.params.id, {
        note: data.note,
        postedBy: data.postedBy ?? null,
    });
    res.status(201).json({ item });
});
