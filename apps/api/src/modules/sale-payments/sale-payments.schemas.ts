import { z } from "zod";

export const salePaymentParamsSchema = z.object({
  id: z.string().trim().min(1, "sale id requis"),
});

export const salePaymentCreateBodySchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
  amount: z.number().int().positive("amount doit être > 0"),
  reference: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  receivedAt: z.coerce.date().optional().nullable(), // si absent => now()
});

export type SalePaymentParams = z.infer<typeof salePaymentParamsSchema>;
export type SalePaymentCreateBody = z.infer<typeof salePaymentCreateBodySchema>;