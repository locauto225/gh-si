import { prisma } from "../../db/prisma";
import type { Prisma } from "@prisma/client";
import { stockService } from "../stock/stock.service";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type {
  DeliveriesListQuery,
  DeliveriesAvailableQuery,
  DeliveryAddEventInput,
  DeliveryAssignInput,
  DeliveryCreateInput,
  DeliverySetStatusInput,
  DeliveryStatus,
} from "./deliveries.schemas";
import { DELIVERY_STATUSES } from "./deliveries.schemas";
import crypto from "crypto";

const SALE_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;

function makeDeliveryNumber(now = new Date()) {
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `DL-${y}${mm}${dd}-${rand}`;
}

function makeTrackingToken() {
  // token public non devinable, URL-safe
  return crypto.randomBytes(18).toString("base64url");
}

function normalizeStatusFilter(raw: string): DeliveryStatus[] | null {
  const s = (raw ?? "").trim();
  if (!s || s === "all") return null;

  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const out: DeliveryStatus[] = [];
  for (const p of parts) {
    if (!DELIVERY_STATUSES.includes(p as DeliveryStatus)) {
      throw new AppError("Invalid status filter", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { status: p, allowed: [...DELIVERY_STATUSES, "all"] },
      });
    }
    out.push(p as DeliveryStatus);
  }

  return Array.from(new Set(out));
}

async function assertDeliveryExists(id: string) {
  const item = await prisma.delivery.findUnique({
    where: { id },
    include: {
      sale: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
      order: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
      warehouse: true,
      driver: true,
      trip: true,
      stop: true,
      lines: { include: { saleLine: { include: { product: true } } } },
      items: { include: { product: true } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) {
    throw new AppError("Delivery not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return item;
}

function assertAllowedTransition(current: DeliveryStatus, next: DeliveryStatus) {
  // Règles "pro" simples
  const allowed: Record<DeliveryStatus, DeliveryStatus[]> = {
    DRAFT: ["PREPARED", "CANCELLED"],
    PREPARED: ["OUT_FOR_DELIVERY", "CANCELLED"],
    OUT_FOR_DELIVERY: ["PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "CANCELLED"],
    PARTIALLY_DELIVERED: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"],
    DELIVERED: [],
    FAILED: [],
    CANCELLED: [],
  };

  if (!allowed[current].includes(next)) {
    throw new AppError("Transition de statut interdite", {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: { from: current, to: next, allowed: allowed[current] },
    });
  }
}


async function applyDeliveryToSaleLinesTx(
  tx: Prisma.TransactionClient,
  deliveryId: string
) {
  // Appliquer qtyDelivered (cumul) sur SaleLine, une seule fois (car on verrouille après PARTIALLY/DELIVERED)
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      sale: { include: { lines: true } },
      lines: true,
    },
  });

  if (!delivery) {
    throw new AppError("Delivery not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }

  const sale = delivery.sale;
  if (!sale) {
    throw new AppError("Sale linked to delivery not found", {
      status: 409,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: { deliveryId },
    });
  }

  // Vérifier et appliquer
  for (const dl of delivery.lines) {
    const sl = sale.lines.find((x) => x.id === dl.saleLineId);
    if (!sl) {
      throw new AppError("SaleLine not found for delivery line", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { deliveryId, saleLineId: dl.saleLineId },
      });
    }

    const already = sl.qtyDelivered ?? 0;
    const newDelivered = already + dl.qtyDelivered;

    if (newDelivered > sl.qty) {
      throw new AppError("Delivered quantity exceeds ordered quantity", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: {
          saleLineId: sl.id,
          ordered: sl.qty,
          alreadyDelivered: already,
          tryingToDeliver: dl.qtyDelivered,
        },
      });
    }
  }

  for (const dl of delivery.lines) {
    const sl = sale.lines.find((x) => x.id === dl.saleLineId)!;
    await tx.saleLine.update({
      where: { id: sl.id },
      data: { qtyDelivered: (sl.qtyDelivered ?? 0) + dl.qtyDelivered },
    });
  }
}

async function applyDeliveryToOrderLinesTx(
  tx: Prisma.TransactionClient,
  deliveryId: string
) {
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: { include: { lines: true } },
      items: true,
    },
  });

  if (!delivery) {
    throw new AppError("Delivery not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }

  const order = delivery.order;
  if (!order) {
    throw new AppError("Order linked to delivery not found", {
      status: 409,
      code: ERROR_CODES.VALIDATION_ERROR,
      details: { deliveryId },
    });
  }

  // Vérifier cumul livré <= qty commandée
  for (const it of delivery.items) {
    const ol = order.lines.find((x) => x.productId === it.productId);
    if (!ol) {
      throw new AppError("OrderLine not found for delivery item", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { deliveryId, productId: it.productId },
      });
    }

    const already = ol.qtyDelivered ?? 0;
    const newDelivered = already + it.qty;

    if (newDelivered > ol.qty) {
      throw new AppError("Delivered quantity exceeds ordered quantity", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: {
          productId: it.productId,
          ordered: ol.qty,
          alreadyDelivered: already,
          tryingToDeliver: it.qty,
        },
      });
    }
  }

  // Appliquer
  for (const it of delivery.items) {
    const ol = order.lines.find((x) => x.productId === it.productId)!;
    await tx.orderLine.update({
      where: { id: ol.id },
      data: { qtyDelivered: (ol.qtyDelivered ?? 0) + it.qty },
    });
  }
}

// Helper to create a delivery event inside a transaction
async function createEventTx(
  tx: Prisma.TransactionClient,
  deliveryId: string,
  input: { type: string; status?: DeliveryStatus | null; message?: string | null; meta?: string | null }
) {
  await tx.deliveryEvent.create({
    data: {
      deliveryId,
      type: input.type,
      status: input.status ?? null,
      message: input.message?.trim() || null,
      meta: input.meta?.trim() || null,
    },
  });
}

export const deliveriesService = {
  list: async (q: DeliveriesListQuery) => {
    const statuses = normalizeStatusFilter(q.status);

    const where: any = {
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
      ...(q.driverId ? { driverId: q.driverId } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { sale: { number: { contains: q.q } } },
              { sale: { client: { nameSearch: { contains: q.q.toLowerCase() } } } },
            ],
          }
        : {}),
    };

    const items = await prisma.delivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: {
        sale: { include: { client: true } },
        order: { include: { client: true } },
        warehouse: true,
        driver: true,
        trip: true,
        stop: true,
        lines: { include: { saleLine: { include: { product: true } } } },
        items: { include: { product: true } },
      },
    });

    return { items };
  },

  // BL disponibles = non affectés à une tournée / un arrêt
  available: async (q: DeliveriesAvailableQuery) => {
    const statuses = normalizeStatusFilter(q.status);

    const where: any = {
      tripId: null,
      stopId: null,
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { number: { startsWith: q.q } },
              { sale: { number: { contains: q.q } } },
              { sale: { number: { startsWith: q.q } } },
              { sale: { client: { nameSearch: { contains: q.q.toLowerCase() } } } },
              { sale: { client: { nameSearch: { startsWith: q.q.toLowerCase() } } } },
            ],
          }
        : {}),
    };

    const items = await prisma.delivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: {
        sale: { include: { client: true } },
        order: { include: { client: true } },
        warehouse: true,
        driver: true,
        trip: true,
        stop: true,
      },
    });

    return { items };
  },

  get: async (id: string) => {
    const item = await assertDeliveryExists(id);
    return { item };
  },

  /**
   * Créer un BL depuis une vente POSTED (recommandé)
   * - génère number + trackingToken
   * - status PREPARED (prêt)
   * - lignes = { saleLineId, qtyDelivered } (partiel OK)
   * NOTE: on N'applique PAS au SaleLine.qtyDelivered ici.
   *       On applique quand le statut passe à PARTIALLY_DELIVERED / DELIVERED.
  */
  create: async (data: DeliveryCreateInput | any) => {
    // ✅ Cas 1bis — BL depuis une commande (Order)
    // Shape: { orderId, driverId?, note?, lines:[{ orderLineId? | productId?, qtyDelivered, note? }] }
    if (data?.orderId && !data?.saleId) {
      const orderId = String(data.orderId ?? "").trim();

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true, warehouse: true, lines: true },
      });

      if (!order) {
        throw new AppError("Order not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }

      if (order.status === "DRAFT" || order.status === "CANCELLED") {
        throw new AppError("Invalid order status", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { status: order.status },
        });
      }

      const number = makeDeliveryNumber();
      const trackingToken = makeTrackingToken();

      const items = (data.lines ?? []).map((l: any) => {
        const orderLineId = l.orderLineId ? String(l.orderLineId).trim() : "";
        const productId = l.productId ? String(l.productId).trim() : "";

        const ol = orderLineId
          ? order.lines.find((x) => x.id === orderLineId)
          : order.lines.find((x) => x.productId === productId);

        if (!ol) {
          throw new AppError("OrderLine not found", {
            status: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            details: { orderLineId: orderLineId || undefined, productId: productId || undefined },
          });
        }

        const qtyDelivered = Number(l.qtyDelivered);
        const remaining = ol.qty - (ol.qtyDelivered ?? 0);

        if (!Number.isFinite(qtyDelivered) || qtyDelivered <= 0) {
          throw new AppError("qtyDelivered invalide", {
            status: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            details: { qtyDelivered },
          });
        }

        if (qtyDelivered > remaining) {
          throw new AppError("Quantity exceeds remaining to deliver", {
            status: 409,
            code: ERROR_CODES.VALIDATION_ERROR,
            details: { productId: ol.productId, remaining, requested: qtyDelivered },
          });
        }

        return { productId: ol.productId, qty: qtyDelivered, note: l.note?.trim() || null };
      });

      if (!items.length) {
        throw new AppError("Au moins une ligne requise", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }

      const item = await prisma.delivery.create({
        data: {
          number,
          status: "PREPARED",
          order: { connect: { id: order.id } },
          warehouse: { connect: { id: order.warehouseId } },
          driver: data.driverId ? { connect: { id: String(data.driverId) } } : undefined,
          note: data.note?.trim() || null,
          trackingToken,

          items: { create: items },

          events: {
            create: {
              type: "PREPARED",
              status: "PREPARED",
              message: "Bon de livraison préparé",
            },
          },
        },
        include: {
          sale: { include: { client: true } },
          order: { include: { client: true, warehouse: true } },
          warehouse: true,
          driver: true,
          trip: true,
          stop: true,
          lines: { include: { saleLine: { include: { product: true } } } },
          items: { include: { product: true } },
          events: { orderBy: { createdAt: "desc" } },
        },
      });

      return { item };
    }

    // Cas 2 — BL hors vente (interne) : lignes produit direct (DeliveryLineItem)
    // Shape: { fromWarehouseId, (toStoreId|toWarehouseId), driverId?, transferId?, transferPurpose?, note?, lines:[{productId, qty, note?}] }
    if (!data?.saleId) {
      const fromWarehouseId = String(data.fromWarehouseId ?? "").trim();
      if (!fromWarehouseId) {
        throw new AppError("fromWarehouseId requis", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { field: "fromWarehouseId" },
        });
      }

      // Destination: store ou warehouse
      let toWarehouseId: string | null = null;

      if (data.toWarehouseId) {
        toWarehouseId = String(data.toWarehouseId).trim();
      }

      if (data.toStoreId) {
        const sid = String(data.toStoreId).trim();
        const store = await prisma.store.findUnique({
          where: { id: sid },
          select: { id: true, warehouseId: true },
        });
        if (!store) {
          throw new AppError("Store not found", {
            status: 404,
            code: ERROR_CODES.NOT_FOUND,
            details: { storeId: sid },
          });
        }
        toWarehouseId = store.warehouseId;
      }

      if (!toWarehouseId) {
        throw new AppError("Destination requise (toStoreId ou toWarehouseId)", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { fields: ["toStoreId", "toWarehouseId"] },
        });
      }

      // Générer number + trackingToken
      const number = makeDeliveryNumber();
      const trackingToken = makeTrackingToken();

      // (Interne) Traçabilité stock : associer ou préparer un transfert lié à cette livraison.
      // - Si transferId est fourni, on l'associe (si existant).
      // - Sinon, on crée un transfert DRAFT (le stock ne bouge pas ici).
      let transferId: string | null = null;

      // 1) Association explicite
      if (data.transferId) {
        const tid = String(data.transferId).trim();
        if (tid) {
          const t = await prisma.stockTransfer.findUnique({
            where: { id: tid },
            select: { id: true },
          });
          if (!t) {
            throw new AppError("Transfer not found", {
              status: 404,
              code: ERROR_CODES.NOT_FOUND,
              details: { transferId: tid },
            });
          }
          transferId = t.id;
        }
      }

      // 2) Auto: créer un transfert DRAFT si pas fourni
      if (!transferId) {
        const transferLines = (data.lines ?? []).map((l: any) => ({
          productId: String(l.productId).trim(),
          qty: Number(l.qty),
          note: l.note?.trim() || null,
        }));

        const purpose = (data.transferPurpose ? String(data.transferPurpose) : "INTERNAL_DELIVERY") as any;

        const createdTransfer = await stockService.createDeliveryTransferDraft({
          fromWarehouseId,
          toWarehouseId,
          note: `BL ${number} (auto)`,
          purpose,
          lines: transferLines,
        });

        transferId = createdTransfer.item.id;
      }

      const item = await prisma.delivery.create({
        data: {
          number,
          status: "PREPARED",
          warehouse: { connect: { id: fromWarehouseId } },
          driver: data.driverId ? { connect: { id: String(data.driverId) } } : undefined,
          note: data.note?.trim() || null,
          trackingToken,
          transfer: transferId ? { connect: { id: transferId } } : undefined,

          // Lignes hors vente (produit direct)
          items: {
            create: (data.lines ?? []).map((l: any) => ({
              productId: String(l.productId).trim(),
              qty: Number(l.qty),
              note: l.note?.trim() || null,
            })),
          },

          events: {
            create: {
              type: "PREPARED",
              status: "PREPARED",
              message: "Bon de livraison préparé",
            },
          },
        },
        include: {
          sale: { include: { client: true } },
          warehouse: true,
          driver: true,
          trip: true,
          stop: true,
          lines: { include: { saleLine: { include: { product: true } } } },
          items: { include: { product: true } },
          events: { orderBy: { createdAt: "desc" } },
        },
      });

      return { item };
    }
    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId },
      include: {
        client: true,
        warehouse: true,
        lines: true,
      },
    });

    if (!sale) {
      throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    if (!SALE_STATUSES.includes(sale.status as any)) {
      throw new AppError("Invalid sale status", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { status: sale.status },
      });
    }

    if (sale.status !== "POSTED") {
      throw new AppError("Sale must be POSTED before creating a delivery", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { saleStatus: sale.status },
      });
    }

    // Générer number + trackingToken une seule fois (utilisés aussi pour la note du transfert)
    const number = makeDeliveryNumber();
    const trackingToken = makeTrackingToken();

    // (Interne) Traçabilité stock : associer ou préparer un transfert lié à cette livraison.
    // - Si transferId est fourni, on l'associe (si existant).
    // - Sinon, si la vente est en canal STORE et a un storeId, on crée un transfert DRAFT (le stock ne bouge pas ici).
    // IMPORTANT: le transfert auto doit suivre les lignes du BL (partiel), pas toutes les lignes de la vente.
    let transferId: string | null = null;

    // 1) Association explicite
    if (data.transferId) {
      const tid = String(data.transferId).trim();
      if (tid) {
        const t = await prisma.stockTransfer.findUnique({
          where: { id: tid },
          select: { id: true },
        });
        if (!t) {
          throw new AppError("Transfer not found", {
            status: 404,
            code: ERROR_CODES.NOT_FOUND,
            details: { transferId: tid },
          });
        }
        transferId = t.id;
      }
    }

    // 2) Auto: créer un transfert DRAFT pour les ventes magasin (si pas déjà fourni)
    if (!transferId && sale.channel === "STORE" && sale.storeId) {
      const store = await prisma.store.findUnique({
        where: { id: String(sale.storeId) },
        select: { id: true, warehouseId: true },
      });

      if (!store) {
        throw new AppError("Store not found", {
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          details: { storeId: sale.storeId },
        });
      }

      // Construire les lignes du transfert à partir des lignes du BL (partiel possible)
      const transferLines = data.lines.map((l: any) => {
        const sl = sale.lines.find((x) => x.id === l.saleLineId);
        if (!sl) {
          throw new AppError("SaleLine not found", {
            status: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            details: { saleLineId: l.saleLineId },
          });
        }
        return {
          productId: sl.productId,
          qty: l.qtyDelivered,
          note: l.note?.trim() || null,
        };
      });

      // Crée un transfert DRAFT (header + lignes) via stockService (centralisé).
      const createdTransfer = await stockService.createDeliveryTransferDraft({
        fromWarehouseId: sale.warehouseId,
        toWarehouseId: store.warehouseId,
        note: `BL ${number} (auto)`,
        purpose: "INTERNAL_DELIVERY",
        lines: transferLines,
      });

      transferId = createdTransfer.item.id;
    }

    // Vérifier que les lignes existent et que qtyDelivered ne dépasse pas le restant à livrer (au moment de la création)
    for (const l of data.lines) {
      const sl = sale.lines.find((x) => x.id === l.saleLineId);
      if (!sl) {
        throw new AppError("SaleLine not found", {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { saleLineId: l.saleLineId },
        });
      }
      const remaining = sl.qty - (sl.qtyDelivered ?? 0);
      if (l.qtyDelivered > remaining) {
        throw new AppError("Quantity exceeds remaining to deliver", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { saleLineId: sl.id, remaining, requested: l.qtyDelivered },
        });
      }
    }


    const item = await prisma.delivery.create({
      data: {
        number,
        status: "PREPARED",
        sale: { connect: { id: sale.id } },
        warehouse: { connect: { id: sale.warehouseId } },
        driver: data.driverId ? { connect: { id: String(data.driverId) } } : undefined,
        note: data.note?.trim() || null,
        trackingToken,
        transfer: transferId ? { connect: { id: transferId } } : undefined,

        lines: {
          create: data.lines.map((l: any) => ({
            saleLineId: l.saleLineId,
            qtyDelivered: l.qtyDelivered,
            note: l.note?.trim() || null,
          })),
        },

        events: {
          create: {
            type: "PREPARED",
            status: "PREPARED",
            message: "Bon de livraison préparé",
          },
        },
      },
      include: {
        sale: { include: { client: true } },
        warehouse: true,
        driver: true,
        trip: true,
        stop: true,
        lines: { include: { saleLine: { include: { product: true } } } },
        items: { include: { product: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });

    return { item };
  },

  /**
   * Changer statut + event
   * - Applique qtyDelivered au SaleLine quand on passe à PARTIALLY_DELIVERED ou DELIVERED
   * - Verrouille ensuite (via transitions)
   */
  setStatus: async (id: string, input: DeliverySetStatusInput) => {
    const existing = await prisma.delivery.findUnique({
      where: { id },
      include: { sale: { include: { lines: true } }, order: { include: { lines: true } }, lines: true, items: true },
    });

    if (!existing) {
      throw new AppError("Delivery not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    const current = existing.status as DeliveryStatus;
    const next = input.status;

    assertAllowedTransition(current, next);

    const item = await prisma.$transaction(async (tx) => {
      // appliquer au moment où on déclare livré (partiel ou total)
      if ((next === "PARTIALLY_DELIVERED" || next === "DELIVERED") && existing.saleId) {
        await applyDeliveryToSaleLinesTx(tx, existing.id);
      }
      if ((next === "PARTIALLY_DELIVERED" || next === "DELIVERED") && existing.orderId) {
        await applyDeliveryToOrderLinesTx(tx, existing.id);
      }

      const data: any = { status: next };

      if (next === "OUT_FOR_DELIVERY" && !existing.dispatchedAt) data.dispatchedAt = new Date();
      if ((next === "PARTIALLY_DELIVERED" || next === "DELIVERED") && !existing.deliveredAt)
        data.deliveredAt = new Date();

      const updated = await tx.delivery.update({
        where: { id: existing.id },
        data,
        include: {
          sale: { include: { client: true, warehouse: true } },
          order: { include: { client: true, warehouse: true } },
          warehouse: true,
          driver: true,
          trip: true,
          stop: true,
          lines: { include: { saleLine: { include: { product: true } } } },
          items: { include: { product: true } },
        },
      });

      await createEventTx(tx, existing.id, {
        type: next,
        status: next,
        message: input.message ?? null,
      });

      return updated;
    });

    // recharger events (tri desc)
    const full = await prisma.delivery.findUnique({
      where: { id: item.id },
      include: {
        sale: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
        order: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
        warehouse: true,
        driver: true,
        trip: true,
        stop: true,
        lines: { include: { saleLine: { include: { product: true } } } },
        items: { include: { product: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });

    return { item: full };
  },

  addEvent: async (id: string, input: DeliveryAddEventInput) => {
    const _ = await assertDeliveryExists(id);

    const item = await prisma.$transaction(async (tx) => {
      await createEventTx(tx, id, {
        type: input.type,
        status: null,
        message: input.message ?? null,
        meta: input.meta ?? null,
      });

      return tx.delivery.findUnique({
        where: { id },
        include: {
          sale: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
          order: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
          warehouse: true,
          driver: true,
          trip: true,
          stop: true,
          lines: { include: { saleLine: { include: { product: true } } } },
          items: { include: { product: true } },
          events: { orderBy: { createdAt: "desc" } },
        },
      });
    });

    return { item };
  },

  assign: async (id: string, input: DeliveryAssignInput) => {
    const existing = await prisma.delivery.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Delivery not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    const rawTripId = input.tripId ? String(input.tripId).trim() : "";
    const rawStopId = input.stopId ? String(input.stopId).trim() : "";

    let tripId: string | null = rawTripId || null;
    let stopId: string | null = rawStopId || null;

    // Si stopId est fourni, on valide l’arrêt et on déduit tripId si absent
    if (stopId) {
      const stop = await prisma.deliveryStop.findUnique({
        where: { id: stopId },
        select: { id: true, tripId: true },
      });
      if (!stop) {
        throw new AppError("Stop not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }

      if (!tripId) tripId = stop.tripId;
      if (tripId && tripId !== stop.tripId) {
        throw new AppError("Stop does not belong to trip", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { tripId, stopTripId: stop.tripId },
        });
      }
    }

    // Si tripId est fourni (ou déduit), on valide la tournée
    if (tripId) {
      const trip = await prisma.deliveryTrip.findUnique({
        where: { id: tripId },
        select: { id: true },
      });
      if (!trip) {
        throw new AppError("Trip not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
      }
    }

    const item = await prisma.delivery.update({
      where: { id },
      data: {
        tripId,
        stopId,
      },
      include: {
        sale: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
        order: { include: { client: true, warehouse: true, lines: { include: { product: true } } } },
        warehouse: true,
        driver: true,
        trip: true,
        stop: true,
        lines: { include: { saleLine: { include: { product: true } } } },
        items: { include: { product: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });

    return { item };
  },

  /**
   * Vue publique via token (pas d'infos sensibles)
   */
  trackByToken: async (token: string) => {
    const item = await prisma.delivery.findUnique({
      where: { trackingToken: token },
      include: {
        sale: { include: { client: true } },
        warehouse: true,
        events: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!item) {
      throw new AppError("Tracking token not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    // réponse "safe"
    return {
      item: {
        id: item.id,
        number: item.number,
        status: item.status,
        createdAt: item.createdAt,
        preparedAt: item.preparedAt,
        dispatchedAt: item.dispatchedAt,
        deliveredAt: item.deliveredAt,
        sale: {
          number: item.sale?.number ?? null,
          clientName: item.sale?.client?.name ?? null,
        },
        warehouse: {
          code: item.warehouse?.code ?? null,
          name: item.warehouse?.name ?? null,
        },
        events: item.events.map((e) => ({
          type: e.type,
          status: e.status,
          message: e.message,
          createdAt: e.createdAt,
        })),
      },
    };
  },
};
