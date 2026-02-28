import { z } from "zod";

export const inventoryStatusSchema = z.enum(["DRAFT", "POSTED", "CANCELLED"]);
export const inventoryModeSchema = z.enum(["FULL", "CATEGORY", "FREE"]);
export const inventoryLineStatusSchema = z.enum(["PENDING", "COUNTED", "SKIPPED"]);

export const inventoriesListQuerySchema = z.object({
  warehouseId: z.string().optional(),
  status: inventoryStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// CREATE inventory draft (document)
export const inventoryCreateSchema = z.object({
  warehouseId: z.string().min(1, "warehouseId requis"),
  mode: inventoryModeSchema.default("FULL"),
  categoryId: z.string().optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
});

// GENERATE lines
export const inventoryGenerateLinesSchema = z.object({
  mode: inventoryModeSchema.optional(), // si tu veux forcer à ce moment-là
  categoryId: z.string().optional().nullable(),
});

// UPDATE one line (counting)
export const inventoryLineUpdateSchema = z.object({
  countedQty: z.coerce.number().int().min(0, "countedQty doit être >= 0").optional(),
  status: inventoryLineStatusSchema.optional(),
  note: z.string().trim().max(255).optional().nullable(),
});

// POST / close inventory
export const inventoryPostSchema = z.object({
  // garde-fou audit : note obligatoire
  note: z.string().trim().min(3, "note obligatoire").max(255),
  // optionnel pour plus tard (quand tu ajoutes auth/roles)
  postedBy: z.string().trim().max(80).optional().nullable(),
});

export type InventoriesListQuery = z.infer<typeof inventoriesListQuerySchema>;
export type InventoryCreateInput = z.infer<typeof inventoryCreateSchema>;
export type InventoryGenerateLinesInput = z.infer<typeof inventoryGenerateLinesSchema>;
export type InventoryLineUpdateInput = z.infer<typeof inventoryLineUpdateSchema>;
export type InventoryPostInput = z.infer<typeof inventoryPostSchema>;