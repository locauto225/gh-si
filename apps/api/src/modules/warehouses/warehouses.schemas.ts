import { z } from "zod";

export const warehouseCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code requis")
    .max(32, "Code trop long")
    // simple + robuste (évite espaces/accents)
    .regex(/^[A-Z0-9_]+$/, "Code: A-Z, 0-9, underscore uniquement")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Nom requis").max(120, "Nom trop long"),
  address: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const warehouseUpdateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/)
    .transform((v) => v.toUpperCase())
    .optional(),
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().max(255).optional().nullable(),

  // Grille tarifaire par défaut (nullable)
  priceListId: z.string().trim().min(1).optional().nullable(),
});

export const warehouseStatusSchema = z.object({
  isActive: z.boolean(),
});

// --- List query (GET /warehouses)
// status:
// - active   => isActive=true AND deletedAt=null
// - inactive => isActive=false OR deletedAt!=null
// - all      => no status filter
// kind:
// - DEPOT | STORE | all
export const warehousesListQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).default("active"),
  kind: z.enum(["DEPOT", "STORE", "all"]).default("DEPOT"),
  q: z
    .string()
    .trim()
    .min(1)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;
export type WarehouseStatusInput = z.infer<typeof warehouseStatusSchema>;
export type WarehousesListQuery = z.infer<typeof warehousesListQuerySchema>;