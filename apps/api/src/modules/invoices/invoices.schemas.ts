import { z } from "zod";

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "SENT",
  "ACCEPTED",
  "ERROR",
  "CANCELLED",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoicesListQuerySchema = z.object({
  // Filtre: "all" (défaut) ou liste CSV: "ISSUED,SENT" etc.
  status: z.string().trim().optional().default("all"),
  q: z.string().trim().optional(),
  warehouseId: z.string().trim().min(1).optional(),
  clientId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const invoiceLineCreateSchema = z.object({
  productId: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().min(1).max(255),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().min(0).default(0), // FCFA

  // Taxes (optionnel) — snapshot au moment de la facture (utile pour FNE)
  taxCode: z.string().trim().max(50).optional().nullable(),
  taxRate: z.number().min(0).max(100).optional().nullable(), // %
});

export const invoiceCreateSchema = z.object({
  // Facture manuelle
  warehouseId: z.string().trim().min(1, "warehouseId requis"),
  clientId: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  lines: z.array(invoiceLineCreateSchema).min(1, "Au moins 1 ligne"),
});

export const invoiceFromSaleCreateSchema = z.object({
  saleId: z.string().trim().min(1, "saleId requis"),
});

export const invoiceSetStatusSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
});

export type InvoicesListQuery = z.infer<typeof invoicesListQuerySchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceFromSaleCreateInput = z.infer<typeof invoiceFromSaleCreateSchema>;
export type InvoiceSetStatusInput = z.infer<typeof invoiceSetStatusSchema>;
export type InvoiceLineCreateInput = z.infer<typeof invoiceLineCreateSchema>;