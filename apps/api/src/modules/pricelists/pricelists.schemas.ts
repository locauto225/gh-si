// apps/api/src/modules/pricelists/pricelists.schemas.ts
import { z } from "zod";

/**
 * status:
 * - active   => isActive = true AND deletedAt = null
 * - inactive => isActive = false AND deletedAt = null
 * - all      => (ignore isActive) AND deletedAt = null
 * (les supprimés = deletedAt != null ne sortent pas)
 */
export const pricelistsListQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const priceListCreateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const priceListUpdateSchema = z.object({
  // Pro: on ne modifie pas code en update (stable pour exports/intégrations)
  name: z.string().trim().min(2).max(120).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  deletedAt: z.coerce.date().optional().nullable(), // si tu veux soft delete via update
});

export const priceListItemCreateSchema = z.object({
  productId: z.string().min(1, "productId requis"),
  unitPrice: z.number().int().min(0, "unitPrice doit être >= 0"),
});

export const priceListItemUpdateSchema = z.object({
  unitPrice: z.number().int().min(0, "unitPrice doit être >= 0"),
});

export type PricelistsListQuery = z.infer<typeof pricelistsListQuerySchema>;
export type PriceListCreateInput = z.infer<typeof priceListCreateSchema>;
export type PriceListUpdateInput = z.infer<typeof priceListUpdateSchema>;
export type PriceListItemCreateInput = z.infer<typeof priceListItemCreateSchema>;
export type PriceListItemUpdateInput = z.infer<typeof priceListItemUpdateSchema>;