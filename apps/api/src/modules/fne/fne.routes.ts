import { Router } from "express";
import { validate } from "../../lib/validate";
import { fneService } from "./fne.service";
import { fneEventCreateSchema, fneEventsListQuerySchema } from "./fne.schemas";

export const fneRouter = Router();

/**
 * GET /fne/events?entity=invoice|sale&entityId=...&status=...&limit=...
 */
fneRouter.get("/events", async (req, res) => {
  const q = validate(fneEventsListQuerySchema, {
    entity: req.query.entity,
    entityId: req.query.entityId,
    status: req.query.status,
    limit: req.query.limit,
  });

  const result = await fneService.listEvents(q);
  res.json(result);
});

/**
 * POST /fne/events (simulation / debug)
 * body: { invoiceId? | saleId?, status, request?, response?, error?, payloadHash?, fneRef? }
 */
fneRouter.post("/events", async (req, res) => {
  const data = validate(fneEventCreateSchema, req.body);
  const result = await fneService.createEvent(data);
  res.status(201).json(result);
});

/**
 * GET /fne/summary
 */
fneRouter.get("/summary", async (_req, res) => {
  const result = await fneService.summary();
  res.json(result);
});