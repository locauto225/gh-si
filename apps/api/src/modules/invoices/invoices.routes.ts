import { Router } from "express";
import {
  invoiceCreateSchema,
  invoiceFromSaleCreateSchema,
  invoicesListQuerySchema,
  invoiceSetStatusSchema,
} from "./invoices.schemas";
import { invoicesService } from "./invoices.service";
import { fneService } from "../fne/fne.service";
import { validate } from "../../lib/validate";

export const invoicesRouter = Router();

/**
 * GET /invoices?status=all|ISSUED|SENT,ERROR&q=...&warehouseId=...&clientId=...&limit=...
 */
invoicesRouter.get("/", async (req, res) => {
  const q = validate(invoicesListQuerySchema, {
    status: String(req.query.status ?? "all"),
    q: req.query.q,
    warehouseId: req.query.warehouseId,
    clientId: req.query.clientId,
    limit: req.query.limit,
  });

  const result = await invoicesService.list(q);
  res.json(result);
});

/**
 * GET /invoices/:id
 */
invoicesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const result = await invoicesService.get(id);
  res.json(result);
});

/**
 * POST /invoices (facture manuelle)
 */
invoicesRouter.post("/", async (req, res) => {
  const data = validate(invoiceCreateSchema, req.body);
  const result = await invoicesService.create(data);
  res.status(201).json(result);
});

/**
 * POST /invoices/from-sale
 * body: { saleId }
 */
invoicesRouter.post("/from-sale", async (req, res) => {
  const data = validate(invoiceFromSaleCreateSchema, req.body);
  const result = await invoicesService.createFromSale(data);
  res.status(201).json(result);
});

/**
 * PATCH /invoices/:id/status
 * body: { status }
 */
invoicesRouter.patch("/:id/status", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const data = validate(invoiceSetStatusSchema, req.body);
  const result = await invoicesService.setStatus(id, data);
  res.json(result);
});

/**
 * POST /invoices/:id/send-fne
 * Endpoint "métier" : déclenche l'envoi FNE (ou au minimum enregistre un événement FNE)
 * Le front peut rester simple : bouton "Envoyer FNE" sur la facture.
 */
invoicesRouter.post("/:id/send-fne", async (req, res) => {
  const id = String(req.params.id ?? "").trim();

  if (typeof (fneService as any)?.sendInvoice !== "function") {
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "FNE service missing sendInvoice",
      },
    });
  }

  const result = await (fneService as any).sendInvoice(id);
  return res.status(201).json(result);
});