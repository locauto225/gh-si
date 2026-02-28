"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const sales_schemas_1 = require("./sales.schemas");
const sales_service_1 = require("./sales.service");
exports.salesRouter = (0, express_1.Router)();
/**
 * GET /sales?status=...&warehouseId=...&storeId=...&q=...&limit=...
 */
exports.salesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(sales_schemas_1.salesListQuerySchema, {
        status: String(req.query.status ?? "all"),
        warehouseId: req.query.warehouseId,
        storeId: req.query.storeId,
        q: req.query.q,
        limit: req.query.limit,
    });
    const result = await sales_service_1.salesService.list(q);
    res.json(result);
});
/**
 * GET /sales/:id
 */
exports.salesRouter.get("/:id", async (req, res) => {
    const result = await sales_service_1.salesService.get(String(req.params.id));
    res.json(result);
});
/**
 * POST /sales/quote
 * body: same as POST /sales (warehouseId/storeId/clientId/note/lines)
 * Returns computed unit prices + totals WITHOUT creating a sale.
 */
exports.salesRouter.post("/quote", async (req, res) => {
    const data = (0, validate_1.validate)(sales_schemas_1.saleCreateSchema, req.body);
    const quoteFn = sales_service_1.salesService.quote;
    if (typeof quoteFn !== "function") {
        return res.status(501).json({
            error: {
                code: "NOT_IMPLEMENTED",
                message: "salesService.quote() n’est pas encore implémenté.",
            },
        });
    }
    const result = await quoteFn(data);
    res.json(result);
});
/**
 * POST /sales
 */
exports.salesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(sales_schemas_1.saleCreateSchema, req.body);
    const result = await sales_service_1.salesService.create(data);
    res.status(201).json(result);
});
/**
 * PATCH /sales/:id/status
 * body: { status: "POSTED" | "CANCELLED" }
 */
exports.salesRouter.patch("/:id/status", async (req, res) => {
    const data = (0, validate_1.validate)(sales_schemas_1.saleSetStatusSchema, req.body);
    const result = await sales_service_1.salesService.setStatus(String(req.params.id), data);
    res.json(result);
});
