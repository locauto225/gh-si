import { z } from "zod";

export const clientsListQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).default("active"),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "name requis").max(120),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),

  address: z.string().trim().max(255).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  taxId: z.string().trim().max(80).optional().nullable(),

  paymentTermsDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  creditLimit: z.coerce.number().int().min(0).optional().nullable(),

  // V1: autorisé, mais tu peux aussi décider de forcer actif à la création
  isActive: z.boolean().optional(),
});

export const clientUpdateSchema = z.object({
  // On autorise le renommage, contrairement au SKU côté produit
  name: z.string().trim().min(1).max(120).optional(),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),

  address: z.string().trim().max(255).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  taxId: z.string().trim().max(80).optional().nullable(),

  paymentTermsDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  creditLimit: z.coerce.number().int().min(0).optional().nullable(),
});

export const clientStatusSchema = z.object({
  isActive: z.boolean(),
});

export type ClientsListQuery = z.infer<typeof clientsListQuerySchema>;
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type ClientStatusInput = z.infer<typeof clientStatusSchema>;