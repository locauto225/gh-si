import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
});

export const categoriesListQuerySchema = z.object({
  includeSubcategories: z
    .preprocess((v) => (typeof v === "string" ? v.toLowerCase() === "true" : v), z.boolean())
    .optional()
    .default(false),
});

export type CategoriesListQuery = z.infer<typeof categoriesListQuerySchema>;

// Params helpers (routes)
export const categoryIdParamSchema = z.object({
  id: z.string().min(1),
});
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;

export const subCategoryIdParamSchema = z.object({
  id: z.string().min(1),
  subId: z.string().min(1),
});
export type SubCategoryIdParam = z.infer<typeof subCategoryIdParamSchema>;

// Delete query (future-safe)
// Today we do SAFE delete (soft-delete). `hard=true` can be supported later for unused entities.
export const deleteQuerySchema = z.object({
  hard: z
    .preprocess((v) => (typeof v === "string" ? v.toLowerCase() === "true" : v), z.boolean())
    .optional()
    .default(false),
});
export type DeleteQuery = z.infer<typeof deleteQuerySchema>;

export const subCategoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  categoryId: z.string().min(1),
});

export type SubCategoryCreateInput = z.infer<typeof subCategoryCreateSchema>;

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;