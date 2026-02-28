"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const orders_service_1 = require("./orders.service");
const orders_schemas_1 = require("./orders.schemas");
exports.ordersRouter = (0, express_1.Router)();
// POST /orders/quote
exports.ordersRouter.post("/quote", async (req, res) => {
    const body = (0, validate_1.validate)(orders_schemas_1.orderQuoteSchema, req.body);
    const result = await orders_service_1.ordersService.quote(body);
    return res.json(result);
});
// POST /orders
exports.ordersRouter.post("/", async (req, res) => {
    const body = (0, validate_1.validate)(orders_schemas_1.orderCreateSchema, req.body);
    const result = await orders_service_1.ordersService.create(body);
    return res.status(201).json(result); // { item }
});
// GET /orders
exports.ordersRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(orders_schemas_1.ordersListQuerySchema, {
        status: req.query.status,
        warehouseId: req.query.warehouseId,
        clientId: req.query.clientId,
        q: req.query.q,
        limit: req.query.limit,
    });
    const result = await orders_service_1.ordersService.list(q);
    return res.json(result); // { items }
});
// GET /orders/:id
exports.ordersRouter.get("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(orders_schemas_1.orderIdParamsSchema, { id: req.params.id });
    const result = await orders_service_1.ordersService.get(p.id);
    return res.json(result); // { item }
});
// PATCH /orders/:id/status
exports.ordersRouter.patch("/:id/status", async (req, res) => {
    const p = (0, validate_1.validate)(orders_schemas_1.orderIdParamsSchema, { id: req.params.id });
    const body = (0, validate_1.validate)(orders_schemas_1.orderSetStatusSchema, req.body);
    const result = await orders_service_1.ordersService.setStatus(p.id, body.status);
    return res.json(result); // { item }
});
