import { z } from "zod";

export const stopPaymentsListQuerySchema = z.object({
  stopId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type StopPaymentsListQuery = z.infer<typeof stopPaymentsListQuerySchema>;

export const stopPaymentCreateSchema = z.object({
  stopId: z.string().trim().min(1),
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
  amount: z.coerce.number().int().min(0),
  reference: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  receivedAt: z.coerce.date().optional(),
});

export type StopPaymentCreateInput = z.infer<typeof stopPaymentCreateSchema>;

export const stopPaymentIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type StopPaymentIdParams = z.infer<typeof stopPaymentIdParamsSchema>;