"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardSummaryQuerySchema = exports.dashboardRangeSchema = void 0;
// apps/api/src/modules/dashboard/dashboard.schemas.ts
const zod_1 = require("zod");
exports.dashboardRangeSchema = zod_1.z.enum(["today", "7d", "30d"]);
exports.dashboardSummaryQuerySchema = zod_1.z.object({
    range: exports.dashboardRangeSchema.default("7d"),
    warehouseId: zod_1.z.string().optional(),
});
