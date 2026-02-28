import { z } from "zod";

export const suppliersListQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).default("active"),
  q: z.string().trim().min(1).max(100).optional(), // recherche (name)
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),

  // Contacts
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email("Email invalide").max(120).optional().nullable(),

  // Champs “pro” (facultatifs mais utiles)
  contactName: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),

  // Comptable / conditions commerciales (V1)
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional().nullable(), // ex: 30
  creditLimit: z.coerce.number().int().min(0).optional().nullable(), // FCFA
  taxId: z.string().trim().max(60).optional().nullable(), // NIF/ID (si dispo)
});

export const supplierUpdateSchema = supplierCreateSchema
  .partial()
  .extend({
    // On évite de “casser” la fiche si quelqu’un envoie des champs vides
    name: z.string().trim().min(2).max(120).optional(),
  });

export const supplierStatusSchema = z.object({
  isActive: z.boolean(),
});

export type SuppliersListQuery = z.infer<typeof suppliersListQuerySchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;
export type SupplierStatusInput = z.infer<typeof supplierStatusSchema>;