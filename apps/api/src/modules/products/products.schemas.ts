import { z } from "zod";

const productBarcodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(64).optional(),
});

const productPackagingSchema = z.object({
  name: z.string().trim().min(1).max(64),
  units: z.number().int().positive(),
  barcode: z.string().trim().min(1).max(64).optional(),
});

const supplierLinkSchema = z.object({
  supplierId: z.string().trim().min(1),
  supplierSku: z.string().trim().min(1).max(64).optional(),
  packagingId: z.string().trim().min(1).optional(),
  lastUnitPrice: z.number().int().min(0).optional(), // FCFA (XOF)
});

export const productCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(32).optional(),
  price: z.number().int().min(0).optional(), // FCFA (XOF) - entier
  isActive: z.boolean().optional(),

  // ✅ Achat (prix de référence)
  purchasePrice: z.number().int().min(0).optional(), // FCFA (XOF) - entier

  // ✅ Boissons (optionnels)
  brand: z.string().min(1).max(120).optional(),

  // ✅ Catégorie
  categoryId: z.string().min(1).optional(),

  // ✅ Nouveaux besoins
  barcodes: z.array(productBarcodeSchema).optional(),
  packagings: z.array(productPackagingSchema).optional(),
  subCategoryIds: z.array(z.string().trim().min(1)).optional(),
  suppliers: z.array(supplierLinkSchema).optional(),
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