import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES, insufficientStockError } from "../../lib/errors";
import type { SaleCreateInput, SaleQuoteInput, SaleSetStatusInput, SalesListQuery } from "./sales.schemas";
import { pricelistsService } from "../pricelists/pricelists.service";

const SALE_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
type SaleStatus = (typeof SALE_STATUSES)[number];

function makeSaleNumber(now = new Date()) {
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SA-${y}${mm}${dd}-${rand}`;
}

function normalizeStatusFilter(raw: string): SaleStatus[] | null {
  const s = (raw ?? "").trim();
  if (!s || s === "all") return null;

  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const out: SaleStatus[] = [];
  for (const p of parts) {
    if (!SALE_STATUSES.includes(p as SaleStatus)) {
      throw new AppError("Invalid status filter", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { status: p, allowed: [...SALE_STATUSES, "all"] },
      });
    }
    out.push(p as SaleStatus);
  }

  // uniq
  return Array.from(new Set(out));
}

async function assertSaleExists(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      lines: { include: { product: true } },
    },
  });
  if (!sale) {
    throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return sale;
}

export const salesService = {
  list: async (q: SalesListQuery) => {
    const statuses = normalizeStatusFilter(q.status);

    const where: any = {
      // soft-delete pas encore sur Sale, donc pas de deletedAt ici
      channel: "STORE",
      ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
      ...(q.storeId ? { storeId: q.storeId } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(q.q
        ? {
            OR: [
              { number: { contains: q.q } },
              { client: { nameSearch: { contains: q.q.toLowerCase() } } },
            ],
          }
        : {}),
    };

    const items = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
    });

    return { items };
  },

  get: async (id: string) => {
    const item = await prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
        posReceipt: {
          select: { id: true, number: true, issuedAt: true },
        },
      },
    });

    if (!item) {
      throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }
    if (item.channel !== "STORE") {
      throw new AppError("Sale not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }
    return { item };
  },

  quote: async (data: SaleQuoteInput) => {
    // --- POS only
    const storeId = String(data.storeId);
    const fulfillment = data.fulfillment;
    const shippingFee = fulfillment === "PICKUP" ? 0 : Math.trunc(data.shippingFee ?? 0);

    // --- Récupérer la grille tarifaire effective (POS = magasin)
    const store = await prisma.store.findUnique({
      where: { id: storeId! },
      select: { id: true, warehouseId: true, priceListId: true },
    });

    if (!store) {
      throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    if (store.warehouseId !== data.warehouseId) {
      throw new AppError("Incohérence entre store et entrepôt", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { storeWarehouseId: store.warehouseId, warehouseId: data.warehouseId },
      });
    }

    const effectivePriceListId = store.priceListId ?? null;

    if (!effectivePriceListId) {
      throw new AppError("Grille tarifaire manquante", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: {
          warehouseId: data.warehouseId,
          storeId,
        },
      });
    }

    // --- Lignes : calcul des PU (STRICT) si unitPrice absent => grille
    const autoProductIds = data.lines
      .filter((l) => !(typeof l.unitPrice === "number" && Number.isFinite(l.unitPrice)))
      .map((l) => l.productId);

    const pricesMap = await pricelistsService.getEffectivePricesBatch(autoProductIds, effectivePriceListId);

    const lines = data.lines.map((l) => {
      const provided = l.unitPrice;
      if (typeof provided === "number" && Number.isFinite(provided)) {
        return {
          productId: l.productId,
          qty: l.qty,
          unitPrice: Math.trunc(provided),
          source: "MANUAL" as const,
        };
      }

      const fromGrid = pricesMap.get(l.productId);
      // sécurité: normalement jamais null car le batch throw si manquant
      if (fromGrid == null) {
        throw new AppError("Tarif manquant pour le produit", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { productId: l.productId, priceListId: effectivePriceListId },
        });
      }

      return {
        productId: l.productId,
        qty: l.qty,
        unitPrice: Math.trunc(fromGrid),
        source: "PRICELIST" as const,
      };
    });

    const totalHT = lines.reduce((sum, l) => sum + l.qty * (l.unitPrice ?? 0), 0);
    // V1: pas de TVA/remise => TTC = HT + frais livraison éventuel
    const totalTTC = totalHT + shippingFee;

    return {
      effectivePriceListId,
      fulfillment,
      shippingFee,
      lines,
      totalHT,
      totalTTC,
    };
  },

  create: async (data: SaleCreateInput) => {
    const number = makeSaleNumber();

    // V1: on accepte clientId null (vente comptoir)
    const clientId = data.clientId ? String(data.clientId) : null;

    // --- POS only
    const storeId = String(data.storeId);
    const fulfillment = data.fulfillment;
    const shippingFee = fulfillment === "PICKUP" ? 0 : Math.trunc(data.shippingFee ?? 0);

    // --- Récupérer la grille tarifaire effective (POS = magasin)
    const store = await prisma.store.findUnique({
      where: { id: storeId! },
      select: { id: true, warehouseId: true, priceListId: true },
    });

    if (!store) {
      throw new AppError("Store not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    if (store.warehouseId !== data.warehouseId) {
      throw new AppError("Incohérence entre store et entrepôt", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { storeWarehouseId: store.warehouseId, warehouseId: data.warehouseId },
      });
    }

    const effectivePriceListId = store.priceListId ?? null;

    if (!effectivePriceListId) {
      throw new AppError("Grille tarifaire manquante", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: {
          warehouseId: data.warehouseId,
          storeId: storeId,
        },
      });
    }

    // --- Lignes : si unitPrice absent => calcul STRICT depuis la grille
    const autoProductIds = data.lines
      .filter((l) => !(typeof l.unitPrice === "number" && Number.isFinite(l.unitPrice)))
      .map((l) => l.productId);

    const pricesMap = await pricelistsService.getEffectivePricesBatch(autoProductIds, effectivePriceListId);

    const lines = data.lines.map((l) => {
      const provided = l.unitPrice;
      if (typeof provided === "number" && Number.isFinite(provided)) {
        return {
          productId: l.productId,
          qty: l.qty,
          unitPrice: Math.trunc(provided),
        };
      }

      const fromGrid = pricesMap.get(l.productId);
      // sécurité: normalement jamais null car le batch throw si manquant
      if (fromGrid == null) {
        throw new AppError("Tarif manquant pour le produit", {
          status: 409,
          code: ERROR_CODES.VALIDATION_ERROR,
          details: { productId: l.productId, priceListId: effectivePriceListId },
        });
      }

      return {
        productId: l.productId,
        qty: l.qty,
        unitPrice: Math.trunc(fromGrid),
      };
    });

    const totalHT = lines.reduce((sum, l) => sum + l.qty * (l.unitPrice ?? 0), 0);
    // V1: pas de TVA/remise => TTC = HT + frais livraison éventuel
    const totalTTC = totalHT + shippingFee;

    const item = await prisma.sale.create({
      data: {
        number,
        status: "DRAFT",
        channel: "STORE",
        fulfillment,
        shippingFee,
        warehouseId: data.warehouseId,
        storeId: storeId,
        clientId,
        note: data.note?.trim() || null,
        totalHT,
        totalTTC,
        lines: {
          create: lines,
        },
      },
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
    });

    return { item };
  },

  /**
   * Change le statut. Si POSTED => décrémente le stock (OUT) de façon atomique.
   * Règles "pro":
   * - DRAFT -> POSTED/CANCELLED
   * - POSTED -> (locked)
   * - CANCELLED -> (locked)
   */
  setStatus: async (id: string, input: SaleSetStatusInput) => {
    const sale = await assertSaleExists(id);

    const next = input.status;
    const current = sale.status as SaleStatus;

    const allowed: Record<SaleStatus, SaleStatus[]> = {
      DRAFT: ["POSTED", "CANCELLED"],
      POSTED: [],
      CANCELLED: [],
    };

    if (!allowed[current].includes(next)) {
      throw new AppError("Transition de statut interdite", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { from: current, to: next, allowed: allowed[current] },
      });
    }

    // Si on poste: créer des mouvements OUT + mettre à jour StockItem en transaction
    if (next === "POSTED") {
      const posted = await prisma.$transaction(async (tx) => {
        // 1) vérifier stock suffisant pour chaque ligne
        for (const line of sale.lines) {
          const onHand = await tx.stockItem.findUnique({
            where: { warehouseId_productId: { warehouseId: sale.warehouseId, productId: line.productId } },
          });
          const available = onHand?.quantity ?? 0;
          if (line.qty > available) {
            throw insufficientStockError({ available, requested: line.qty });
          }
        }

        // 2) appliquer OUT + StockItem
        for (const line of sale.lines) {
          // stockItem upsert
          const current = await tx.stockItem.findUnique({
            where: { warehouseId_productId: { warehouseId: sale.warehouseId, productId: line.productId } },
          });

          const newQty = (current?.quantity ?? 0) - line.qty;
          if (newQty < 0) {
            // sécurité (normalement déjà bloqué)
            throw insufficientStockError({
              available: current?.quantity ?? 0,
              requested: line.qty,
            });
          }

          await tx.stockItem.upsert({
            where: { warehouseId_productId: { warehouseId: sale.warehouseId, productId: line.productId } },
            create: { warehouseId: sale.warehouseId, productId: line.productId, quantity: newQty },
            update: { quantity: newQty },
          });

          await tx.stockMove.create({
            data: {
              kind: "OUT",
              warehouseId: sale.warehouseId,
              productId: line.productId,
              qtyDelta: -line.qty,
              refType: "SALE",
              refId: sale.id,
              note: sale.note ?? null,
            },
          });
        }

        const totalHT = sale.lines.reduce((sum, l) => sum + l.qty * (l.unitPrice ?? 0), 0);
        // Inclure shippingFee uniquement si livraison
        const totalTTC = totalHT + (sale.fulfillment === "DELIVERY" ? (sale.shippingFee ?? 0) : 0);

        let posReceipt: any = null;
        if (!sale.storeId) {
          throw new AppError("storeId manquant sur la vente POS", {
            status: 500,
            code: ERROR_CODES.INTERNAL_ERROR,
          });
        }
        // vente magasin => ticket de caisse
        const now = new Date();
        const y = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const rand = Math.floor(Math.random() * 9000) + 1000;
        const number = `TCK-${y}${mm}${dd}-${rand}`;

        posReceipt = await tx.posReceipt.create({
          data: {
            number,
            saleId: sale.id,
            storeId: sale.storeId!,
            totalTTC,
            amountPaid: sale.amountPaid ?? 0,
            issuedAt: now,
          },
        });

        // 3) statut
        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: { status: "POSTED", totalHT, totalTTC, postedAt: new Date() },
          include: {
            client: true,
            warehouse: true,
            lines: { include: { product: true } },
            posReceipt: {
              select: { id: true, number: true, issuedAt: true },
            },
          },
        });

        return { updated, posReceipt };
      });

      return {
        item: posted.updated,
        posReceipt: posted.posReceipt
          ? { id: posted.posReceipt.id, number: posted.posReceipt.number, issuedAt: posted.posReceipt.issuedAt }
          : null,
      };
    }

    // CANCELLED (DRAFT -> CANCELLED) : pas d’impact stock
    const item = await prisma.sale.update({
      where: { id },
      data: { status: next },
      include: {
        client: true,
        warehouse: true,
        lines: { include: { product: true } },
        posReceipt: {
          select: { id: true, number: true, issuedAt: true },
        },
      },
    });

    return { item };
  },
};