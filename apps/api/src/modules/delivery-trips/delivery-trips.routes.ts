// apps/api/src/modules/delivery-trips/delivery-trips.routes.ts
import { Router } from "express";
import {
  deliveryTripCreateSchema,
  deliveryTripsListQuerySchema,
  deliveryTripSetStatusSchema,
  deliveryStopCreateSchema,
  stopSetStatusSchema,
  stopPaymentCreateSchema,
  stopDeliveriesAttachSchema,
} from "./delivery-trips.schemas";
import { deliveryTripsService } from "./delivery-trips.service";

export const deliveryTripsRouter = Router();

// GET /delivery-trips
deliveryTripsRouter.get("/", async (req, res, next) => {
  try {
    const q = deliveryTripsListQuerySchema.parse(req.query);
    const out = await deliveryTripsService.list(q);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// GET /delivery-trips/:id
deliveryTripsRouter.get("/:id", async (req, res, next) => {
  try {
    const out = await deliveryTripsService.get(req.params.id);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// POST /delivery-trips
deliveryTripsRouter.post("/", async (req, res, next) => {
  try {
    const input = deliveryTripCreateSchema.parse(req.body);
    const out = await deliveryTripsService.create(input);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

// PATCH /delivery-trips/:id/status
deliveryTripsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const input = deliveryTripSetStatusSchema.parse(req.body);
    const out = await deliveryTripsService.setStatus(req.params.id, input);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// POST /delivery-trips/:id/stops
deliveryTripsRouter.post("/:id/stops", async (req, res, next) => {
  try {
    const input = deliveryStopCreateSchema.parse(req.body);
    const out = await deliveryTripsService.addStop(req.params.id, input);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

// PATCH /delivery-trips/stops/:stopId/status
deliveryTripsRouter.patch("/stops/:stopId/status", async (req, res, next) => {
  try {
    const input = stopSetStatusSchema.parse(req.body);
    const out = await deliveryTripsService.setStopStatus(req.params.stopId, input);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

// POST /delivery-trips/stops/:stopId/payments
deliveryTripsRouter.post("/stops/:stopId/payments", async (req, res, next) => {
  try {
    const input = stopPaymentCreateSchema.parse(req.body);
    const out = await deliveryTripsService.addStopPayment(req.params.stopId, input);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

// POST /delivery-trips/stops/:stopId/deliveries
// Bulk attach deliveries to a stop
deliveryTripsRouter.post("/stops/:stopId/deliveries", async (req, res, next) => {
  try {
    const input = stopDeliveriesAttachSchema.parse(req.body);
    const out = await deliveryTripsService.addDeliveriesToStop(req.params.stopId, input);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});