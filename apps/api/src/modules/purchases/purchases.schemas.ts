
import { z } from "zod";

const purchaseStatusEnum = z.enum([
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const purchasesListQuerySchema = z.object({
  status: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return "all";
      const s = String(v).trim();
      if (!s) return "all";
      if (s === "all") return "all";
      if (s.includes(",")) {
        return s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }
      return s;
    },
    z.union([z.literal("all"), purchaseStatusEnum, z.array(purchaseStatusEnum).min(1)])
  ),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const purchaseCreateSchema = z.object({
  supplierId: z.string().min(1, "supplierId requis"),
  warehouseId: z.string().min(1, "warehouseId requis"),
  note: z.string().trim().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, "productId requis"),
        qtyOrdered: z.number().int().positive("qtyOrdered doit être > 0"),
        unitPrice: z.number().int().min(0, "unitPrice doit être >= 0"),
      })
    )
    .min(1, "Au moins une ligne est requise"),
});

export const purchaseStatusSchema = z.object({
  status: purchaseStatusEnum,
});

export const purchaseReceiveSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, "productId requis"),
        qtyReceived: z.number().int().min(0, "qtyReceived doit être >= 0"),
      })
    )
    .min(1, "Au moins une ligne est requise"),
});

export type PurchasesListQuery = z.infer<typeof purchasesListQuerySchema>;
export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
export type PurchaseStatusInput = z.infer<typeof purchaseStatusSchema>;
export type PurchaseReceiveInput = z.infer<typeof purchaseReceiveSchema>;