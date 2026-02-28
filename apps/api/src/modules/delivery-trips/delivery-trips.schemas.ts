// apps/api/src/modules/delivery-trips/delivery-trips.schemas.ts
import { z } from "zod";

export const deliveryTripsListQuerySchema = z.object({
  status: z
    .enum(["DRAFT", "LOADED", "IN_PROGRESS", "DONE", "CLOSED", "CANCELLED"])
    .optional(),
  fromWarehouseId: z.string().trim().optional(),
  driverId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type DeliveryTripsListQuery = z.infer<typeof deliveryTripsListQuerySchema>;

export const deliveryTripCreateSchema = z.object({
  fromWarehouseId: z.string().trim().min(1),
  driverId: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export type DeliveryTripCreateInput = z.infer<typeof deliveryTripCreateSchema>;

export const deliveryTripSetStatusSchema = z.object({
  status: z.enum(["DRAFT", "LOADED", "IN_PROGRESS", "DONE", "CLOSED", "CANCELLED"]),
  note: z.string().trim().optional().nullable(),
});

export type DeliveryTripSetStatusInput = z.infer<typeof deliveryTripSetStatusSchema>;

export const deliveryStopCreateSchema = z.object({
  // ordre : si absent => on ajoute à la fin
  sequence: z.coerce.number().int().min(1).optional(),

  clientId: z.string().trim().optional().nullable(),
  storeId: z.string().trim().optional().nullable(),

  addressSnapshot: z.string().trim().optional().nullable(),
  phoneSnapshot: z.string().trim().optional().nullable(),
  contactNameSnapshot: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),

  // Option A: ventes rattachées au stop
  saleIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export type DeliveryStopCreateInput = z.infer<typeof deliveryStopCreateSchema>;

export const stopSetStatusSchema = z.object({
  status: z.enum(["PENDING", "VISITED", "PARTIAL", "DONE", "FAILED", "CANCELLED"]),
  note: z.string().trim().optional().nullable(),
  visitedAt: z.coerce.date().optional(),
});

export type StopSetStatusInput = z.infer<typeof stopSetStatusSchema>;

export const stopPaymentCreateSchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "OTHER"]),
  amount: z.coerce.number().int().min(0),
  reference: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  receivedAt: z.coerce.date().optional(),
});

export type StopPaymentCreateInput = z.infer<typeof stopPaymentCreateSchema>;

// Bulk attach deliveries to a stop (dispatch depuis l'arrêt)
export const stopDeliveriesAttachSchema = z.object({
  deliveryIds: z.array(z.string().trim().min(1)).min(1),
});

export type StopDeliveriesAttachInput = z.infer<typeof stopDeliveriesAttachSchema>;