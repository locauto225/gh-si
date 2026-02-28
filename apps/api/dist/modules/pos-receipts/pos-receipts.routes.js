"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posReceiptsRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const pos_receipts_service_1 = require("./pos-receipts.service");
const pos_receipts_schemas_1 = require("./pos-receipts.schemas");
exports.posReceiptsRouter = (0, express_1.Router)();
// GET /pos/receipts?storeId=...&limit=...
exports.posReceiptsRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(pos_receipts_schemas_1.posReceiptsListQuerySchema, {
        storeId: req.query.storeId,
        limit: req.query.limit,
    });
    const result = await pos_receipts_service_1.posReceiptsService.list(q);
    return res.json(result); // { items: [...] }
});
// GET /pos/receipts/:id
exports.posReceiptsRouter.get("/:id", async (req, res) => {
    const p = (0, validate_1.validate)(pos_receipts_schemas_1.posReceiptIdSchema, { id: req.params.id });
    const result = await pos_receipts_service_1.posReceiptsService.get(p.id);
    return res.json(result); // { item }
});
