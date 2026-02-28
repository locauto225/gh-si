"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
// apps/api/src/modules/dashboard/dashboard.routes.ts
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const dashboard_schemas_1 = require("./dashboard.schemas");
const dashboard_service_1 = require("./dashboard.service");
exports.dashboardRouter = (0, express_1.Router)();
/**
 * GET /dashboard/summary?range=today|7d|30d&warehouseId=...
 */
exports.dashboardRouter.get("/summary", async (req, res, next) => {
    try {
        const q = (0, validate_1.validate)(dashboard_schemas_1.dashboardSummaryQuerySchema, req.query);
        const data = await dashboard_service_1.dashboardService.summary(q);
        res.json(data);
    }
    catch (e) {
        next(e);
    }
});
