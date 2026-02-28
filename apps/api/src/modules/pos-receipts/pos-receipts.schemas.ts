import { z } from "zod";

export const posReceiptsListQuerySchema = z.object({
  storeId: z.string().trim().min(1, "storeId requis"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const posReceiptIdSchema = z.object({
  id: z.string().trim().min(1, "id requis"),
});

export type PosReceiptsListQuery = z.infer<typeof posReceiptsListQuerySchema>;
export type PosReceiptId = z.infer<typeof posReceiptIdSchema>;