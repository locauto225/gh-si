// apps/api/src/modules/stores/stores.schemas.ts
import { z } from "zod";

export const storesListQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).default("active"),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const storeCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional(), // toléré en create, mais service garde cohérence
});

export const storeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(255).optional().nullable(),
  priceListId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  // ⚠️ volontairement PAS de isActive/deletedAt ici (on force via PATCH /:id/status)
});

export const storeSetStatusSchema = z.object({
  isActive: z.boolean(),
});

export type StoresListQuery = z.infer<typeof storesListQuerySchema>;
export type StoreCreateInput = z.infer<typeof storeCreateSchema>;
export type StoreUpdateInput = z.infer<typeof storeUpdateSchema>;
export type StoreSetStatusInput = z.infer<typeof storeSetStatusSchema>;