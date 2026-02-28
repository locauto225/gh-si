import { z } from "zod";

export const listDriversQuerySchema = z.object({
  status: z.enum(["active", "inactive", "all"]).optional().default("active"),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const createDriverBodySchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateDriverBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  isActive: z.boolean().optional(),
  // (optionnel) soft delete si tu veux plus tard :
  // deletedAt: z.coerce.date().optional().nullable(),
});

export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>;
export type CreateDriverBody = z.infer<typeof createDriverBodySchema>;
export type UpdateDriverBody = z.infer<typeof updateDriverBodySchema>;