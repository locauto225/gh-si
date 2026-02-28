import { z } from "zod";

export const invoicePaymentParamsSchema = z.object({
  id: z.string().trim().min(1, "invoice id requis"),
});

export const invoicePaymentCreateBodySchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
  amount: z.number().int().positive("amount doit être > 0"),
  reference: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  receivedAt: z.coerce.date().optional().nullable(),
});

export type InvoicePaymentParams = z.infer<typeof invoicePaymentParamsSchema>;
export type InvoicePaymentCreateBody = z.infer<typeof invoicePaymentCreateBodySchema>;