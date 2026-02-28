"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppliersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../../lib/validate");
const suppliers_service_1 = require("./suppliers.service");
const suppliers_schemas_1 = require("./suppliers.schemas");
exports.suppliersRouter = (0, express_1.Router)();
exports.suppliersRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(suppliers_schemas_1.suppliersListQuerySchema, {
        status: req.query.status,
        q: req.query.q,
        limit: req.query.limit,
    });
    const items = await suppliers_service_1.suppliersService.list(q);
    res.json({ items });
});
exports.suppliersRouter.get("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), { id: req.params.id });
    const item = await suppliers_service_1.suppliersService.get(p.id);
    res.json({ item });
});
exports.suppliersRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(suppliers_schemas_1.supplierCreateSchema, req.body);
    const item = await suppliers_service_1.suppliersService.create(data);
    res.status(201).json({ item });
});
exports.suppliersRouter.put("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), { id: req.params.id });
    const data = (0, validate_1.validate)(suppliers_schemas_1.supplierUpdateSchema, req.body);
    const item = await suppliers_service_1.suppliersService.update(p.id, data);
    res.json({ item });
});
exports.suppliersRouter.patch("/:id/status", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), { id: req.params.id });
    const data = (0, validate_1.validate)(suppliers_schemas_1.supplierStatusSchema, req.body);
    const item = await suppliers_service_1.suppliersService.setStatus(p.id, data);
    res.json({ item });
});
exports.suppliersRouter.delete("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(zod_1.z.object({ id: zod_1.z.string().min(1) }), { id: req.params.id });
    const item = await suppliers_service_1.suppliersService.remove(p.id);
    res.json({ item });
});
