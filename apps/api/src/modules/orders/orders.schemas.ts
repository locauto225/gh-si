import { z } from "zod";

export const orderIdParamsSchema = z.object({
  id: z.string().trim().min(1, "id requis"),
});

export const ordersListQuerySchema = z.object({
  status: z
    .enum(["all", "DRAFT", "CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"])
    .optional()
    .default("all"),
  warehouseId: z.string().trim().min(1).optional(),
  clientId: z.string().trim().min(1).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const orderLineInputSchema = z.object({
  productId: z.string().trim().min(1),
  qty: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0).optional(), // si absent => pricing (pricelist ou product.price)
});

export const orderQuoteSchema = z.object({
  warehouseId: z.string().trim().min(1),
  clientId: z.string().trim().min(1).optional().nullable(),
  lines: z.array(orderLineInputSchema).min(1),
});

export const orderCreateSchema = z.object({
  warehouseId: z.string().trim().min(1),
  clientId: z.string().trim().min(1).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  fulfillment: z.enum(["PICKUP", "DELIVERY"]).optional().default("PICKUP"),
  shippingFee: z.coerce.number().int().min(0).optional().default(0),
  lines: z.array(orderLineInputSchema).min(1),
});

export const orderSetStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"]),
});

export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>;
export type OrderQuoteBody = z.infer<typeof orderQuoteSchema>;
export type OrderCreateBody = z.infer<typeof orderCreateSchema>;
export type OrderSetStatusBody = z.infer<typeof orderSetStatusSchema>;