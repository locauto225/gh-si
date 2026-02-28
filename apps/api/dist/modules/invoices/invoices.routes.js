"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicesRouter = void 0;
const express_1 = require("express");
const invoices_schemas_1 = require("./invoices.schemas");
const invoices_service_1 = require("./invoices.service");
const fne_service_1 = require("../fne/fne.service");
const validate_1 = require("../../lib/validate");
exports.invoicesRouter = (0, express_1.Router)();
/**
 * GET /invoices?status=all|ISSUED|SENT,ERROR&q=...&warehouseId=...&clientId=...&limit=...
 */
exports.invoicesRouter.get("/", async (req, res) => {
    const q = (0, validate_1.validate)(invoices_schemas_1.invoicesListQuerySchema, {
        status: String(req.query.status ?? "all"),
        q: req.query.q,
        warehouseId: req.query.warehouseId,
        clientId: req.query.clientId,
        limit: req.query.limit,
    });
    const result = await invoices_service_1.invoicesService.list(q);
    res.json(result);
});
/**
 * GET /invoices/:id
 */
exports.invoicesRouter.get("/:id", async (req, res) => {
    const id = String(req.params.id ?? "").trim();
    const result = await invoices_service_1.invoicesService.get(id);
    res.json(result);
});
/**
 * POST /invoices (facture manuelle)
 */
exports.invoicesRouter.post("/", async (req, res) => {
    const data = (0, validate_1.validate)(invoices_schemas_1.invoiceCreateSchema, req.body);
    const result = await invoices_service_1.invoicesService.create(data);
    res.status(201).json(result);
});
/**
 * POST /invoices/from-sale
 * body: { saleId }
 */
exports.invoicesRouter.post("/from-sale", async (req, res) => {
    const data = (0, validate_1.validate)(invoices_schemas_1.invoiceFromSaleCreateSchema, req.body);
    const result = await invoices_service_1.invoicesService.createFromSale(data);
    res.status(201).json(result);
});
/**
 * PATCH /invoices/:id/status
 * body: { status }
 */
exports.invoicesRouter.patch("/:id/status", async (req, res) => {
    const id = String(req.params.id ?? "").trim();
    const data = (0, validate_1.validate)(invoices_schemas_1.invoiceSetStatusSchema, req.body);
    const result = await invoices_service_1.invoicesService.setStatus(id, data);
    res.json(result);
});
/**
 * POST /invoices/:id/send-fne
 * Endpoint "métier" : déclenche l'envoi FNE (ou au minimum enregistre un événement FNE)
 * Le front peut rester simple : bouton "Envoyer FNE" sur la facture.
 */
exports.invoicesRouter.post("/:id/send-fne", async (req, res) => {
    const id = String(req.params.id ?? "").trim();
    if (typeof fne_service_1.fneService?.sendInvoice !== "function") {
        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "FNE service missing sendInvoice",
            },
        });
    }
    const result = await fne_service_1.fneService.sendInvoice(id);
    return res.status(201).json(result);
});
