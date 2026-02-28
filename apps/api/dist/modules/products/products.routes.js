"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const errors_1 = require("../../lib/errors");
const products_schemas_1 = require("./products.schemas");
const zod_1 = require("zod");
const products_service_1 = require("./products.service");
exports.productsRouter = (0, express_1.Router)();
exports.productsRouter.get("/", async (req, res) => {
    const querySchema = zod_1.z.object({
        status: zod_1.z.string().optional(),
        q: zod_1.z.string().optional(),
        categoryId: zod_1.z.string().optional(),
        limit: zod_1.z.coerce.number().int().min(1).max(500).optional(),
    });
    const q = (0, validate_1.validate)(querySchema, req.query);
    const statusRaw = q.status ?? "active";
    const status = statusRaw === "all" || statusRaw === "inactive" || statusRaw === "active" ? statusRaw : "active";
    const items = await products_service_1.productsService.list({
        status,
        q: q.q?.trim() ? q.q.trim() : undefined,
        categoryId: q.categoryId?.trim() ? q.categoryId.trim() : undefined,
        limit: typeof q.limit === "number" ? q.limit : undefined,
    });
    res.json({ items });
});
exports.productsRouter.get("/:id", async (req, res) => {
    const item = await products_service_1.productsService.get(req.params.id);
    if (!item)
        throw new errors_1.AppError("Product not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    res.json({ item });
});
exports.productsRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(products_schemas_1.productCreateSchema, req.body);
    const item = await products_service_1.productsService.create(data);
    res.status(201).json({ item });
});
exports.productsRouter.put("/:id", async (req, res) => {
    const data = (0, validate_1.validate)(products_schemas_1.productUpdateSchema, req.body);
    const item = await products_service_1.productsService.update(req.params.id, data);
    res.json({ item });
});
const productStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
exports.productsRouter.patch("/:id/status", async (req, res) => {
    const data = (0, validate_1.validate)(productStatusSchema, req.body);
    const item = await products_service_1.productsService.setStatus(req.params.id, data.isActive);
    res.json({ item });
});
exports.productsRouter.delete("/:id", async (req, res) => {
    const item = await products_service_1.productsService.remove(req.params.id);
    res.json({ item });
});
