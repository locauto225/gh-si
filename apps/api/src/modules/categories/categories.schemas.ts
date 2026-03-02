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

export const subCategoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  categoryId: z.string().min(1),
});

export type SubCategoryCreateInput = z.infer<typeof subCategoryCreateSchema>;

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;