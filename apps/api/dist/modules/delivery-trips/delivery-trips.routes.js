"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryTripsRouter = void 0;
// apps/api/src/modules/delivery-trips/delivery-trips.routes.ts
const express_1 = require("express");
const delivery_trips_schemas_1 = require("./delivery-trips.schemas");
const delivery_trips_service_1 = require("./delivery-trips.service");
exports.deliveryTripsRouter = (0, express_1.Router)();
// GET /delivery-trips
exports.deliveryTripsRouter.get("/", async (req, res, next) => {
    try {
        const q = delivery_trips_schemas_1.deliveryTripsListQuerySchema.parse(req.query);
        const out = await delivery_trips_service_1.deliveryTripsService.list(q);
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
// GET /delivery-trips/:id
exports.deliveryTripsRouter.get("/:id", async (req, res, next) => {
    try {
        const out = await delivery_trips_service_1.deliveryTripsService.get(req.params.id);
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
// POST /delivery-trips
exports.deliveryTripsRouter.post("/", async (req, res, next) => {
    try {
        const input = delivery_trips_schemas_1.deliveryTripCreateSchema.parse(req.body);
        const out = await delivery_trips_service_1.deliveryTripsService.create(input);
        res.status(201).json(out);
    }
    catch (e) {
        next(e);
    }
});
// PATCH /delivery-trips/:id/status
exports.deliveryTripsRouter.patch("/:id/status", async (req, res, next) => {
    try {
        const input = delivery_trips_schemas_1.deliveryTripSetStatusSchema.parse(req.body);
        const out = await delivery_trips_service_1.deliveryTripsService.setStatus(req.params.id, input);
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
// POST /delivery-trips/:id/stops
exports.deliveryTripsRouter.post("/:id/stops", async (req, res, next) => {
    try {
        const input = delivery_trips_schemas_1.deliveryStopCreateSchema.parse(req.body);
        const out = await delivery_trips_service_1.deliveryTripsService.addStop(req.params.id, input);
        res.status(201).json(out);
    }
    catch (e) {
        next(e);
    }
});
// PATCH /delivery-trips/stops/:stopId/status
exports.deliveryTripsRouter.patch("/stops/:stopId/status", async (req, res, next) => {
    try {
        const input = delivery_trips_schemas_1.stopSetStatusSchema.parse(req.body);
        const out = await delivery_trips_service_1.deliveryTripsService.setStopStatus(req.params.stopId, input);
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
// POST /delivery-trips/stops/:stopId/payments
exports.deliveryTripsRouter.post("/stops/:stopId/payments", async (req, res, next) => {
    try {
        const input = delivery_trips_schemas_1.stopPaymentCreateSchema.parse(req.body);
        const out = await delivery_trips_service_1.deliveryTripsService.addStopPayment(req.params.stopId, input);
        res.status(201).json(out);
    }
    catch (e) {
        next(e);
    }
});
// POST /delivery-trips/stops/:stopId/deliveries
// Bulk attach deliveries to a stop
exports.deliveryTripsRouter.post("/stops/:stopId/deliveries", async (req, res, next) => {
    try {
        const input = delivery_trips_schemas_1.stopDeliveriesAttachSchema.parse(req.body);
        const out = await delivery_trips_service_1.deliveryTripsService.addDeliveriesToStop(req.params.stopId, input);
        res.status(201).json(out);
    }
    catch (e) {
        next(e);
    }
});
