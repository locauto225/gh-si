// apps/api/src/modules/dashboard/dashboard.routes.ts
import { Router } from "express";
import { validate } from "../../lib/validate";
import { dashboardSummaryQuerySchema } from "./dashboard.schemas";
import { dashboardService } from "./dashboard.service";

export const dashboardRouter = Router();

/**
 * GET /dashboard/summary?range=today|7d|30d&warehouseId=...
 */
dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    const q = validate(dashboardSummaryQuerySchema, req.query);
    const data = await dashboardService.summary(q);
    res.json(data);
  } catch (e) {
    next(e);
  }
});