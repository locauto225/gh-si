import { z } from "zod";

export const productCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(32).optional(),
  price: z.number().int().min(0).optional(), // FCFA (XOF) - entier
  isActive: z.boolean().optional(),

  // ✅ Boissons (optionnels)
  brand: z.string().min(1).max(120).optional(),
  barcode: z.string().min(1).max(64).optional(),
  packSize: z.number().int().min(1).optional(),

  // ✅ Catégorie (V1: optionnelle pour aller vite)
  categoryId: z.string().min(1).optional(),
});

// Pro: on évite de modifier le SKU après création (risque chaos stock/facturation/intégrations)
export const productUpdateSchema = productCreateSchema.omit({ sku: true }).partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// Query params: /products?status=active&categoryId=...&q=...&limit=...
export const productListQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).optional().default("active"),
  categoryId: z.string().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  limit: z
    .preprocess((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(String(v));
      return Number.isFinite(n) ? n : undefined;
    }, z.number().int().min(1).max(500).optional())
    .default(50),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;