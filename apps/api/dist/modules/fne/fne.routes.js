"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fneRouter = void 0;
const express_1 = require("express");
const validate_1 = require("../../lib/validate");
const fne_service_1 = require("./fne.service");
const fne_schemas_1 = require("./fne.schemas");
exports.fneRouter = (0, express_1.Router)();
/**
 * GET /fne/events?entity=invoice|sale&entityId=...&status=...&limit=...
 */
exports.fneRouter.get("/events", async (req, res) => {
    const q = (0, validate_1.validate)(fne_schemas_1.fneEventsListQuerySchema, {
        entity: req.query.entity,
        entityId: req.query.entityId,
        status: req.query.status,
        limit: req.query.limit,
    });
    const result = await fne_service_1.fneService.listEvents(q);
    res.json(result);
});
/**
 * POST /fne/events (simulation / debug)
 * body: { invoiceId? | saleId?, status, request?, response?, error?, payloadHash?, fneRef? }
 */
exports.fneRouter.post("/events", async (req, res) => {
    const data = (0, validate_1.validate)(fne_schemas_1.fneEventCreateSchema, req.body);
    const result = await fne_service_1.fneService.createEvent(data);
    res.status(201).json(result);
});
/**
 * GET /fne/summary
 */
exports.fneRouter.get("/summary", async (_req, res) => {
    const result = await fne_service_1.fneService.summary();
    res.json(result);
});
