"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceSetStatusSchema = exports.invoiceFromSaleCreateSchema = exports.invoiceCreateSchema = exports.invoiceLineCreateSchema = exports.invoicesListQuerySchema = exports.INVOICE_STATUSES = void 0;
const zod_1 = require("zod");
exports.INVOICE_STATUSES = [
    "DRAFT",
    "ISSUED",
    "SENT",
    "ACCEPTED",
    "ERROR",
    "CANCELLED",
];
exports.invoicesListQuerySchema = zod_1.z.object({
    // Filtre: "all" (défaut) ou liste CSV: "ISSUED,SENT" etc.
    status: zod_1.z.string().trim().optional().default("all"),
    q: zod_1.z.string().trim().optional(),
    warehouseId: zod_1.z.string().trim().min(1).optional(),
    clientId: zod_1.z.string().trim().min(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(100),
});
exports.invoiceLineCreateSchema = zod_1.z.object({
    productId: zod_1.z.string().trim().min(1).optional().nullable(),
    description: zod_1.z.string().trim().min(1).max(255),
    qty: zod_1.z.number().int().positive(),
    unitPrice: zod_1.z.number().int().min(0).default(0), // FCFA
    // Taxes (optionnel) — snapshot au moment de la facture (utile pour FNE)
    taxCode: zod_1.z.string().trim().max(50).optional().nullable(),
    taxRate: zod_1.z.number().min(0).max(100).optional().nullable(), // %
});
exports.invoiceCreateSchema = zod_1.z.object({
    // Facture manuelle
    warehouseId: zod_1.z.string().trim().min(1, "warehouseId requis"),
    clientId: zod_1.z.string().trim().min(1).optional().nullable(),
    note: zod_1.z.string().trim().max(255).optional().nullable(),
    lines: zod_1.z.array(exports.invoiceLineCreateSchema).min(1, "Au moins 1 ligne"),
});
exports.invoiceFromSaleCreateSchema = zod_1.z.object({
    saleId: zod_1.z.string().trim().min(1, "saleId requis"),
});
exports.invoiceSetStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(exports.INVOICE_STATUSES),
});
