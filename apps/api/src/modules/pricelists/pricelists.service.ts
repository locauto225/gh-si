import { prisma } from "../../db/prisma";
import { AppError, ERROR_CODES } from "../../lib/errors";
import type {
  PricelistsListQuery,
  PriceListCreateInput,
  PriceListUpdateInput,
  PriceListItemCreateInput,
  PriceListItemUpdateInput,
} from "./pricelists.schemas";

// --- Mini cache TTL (in-memory) for effective prices
// Key: `${priceListId}:${productId}`
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type PriceCacheEntry = { value: number; expiresAt: number };
const priceCache = new Map<string, PriceCacheEntry>();

function cacheKey(priceListId: string, productId: string) {
  return `${priceListId}:${productId}`;
}

function cacheGet(priceListId: string, productId: string): number | null {
  const k = cacheKey(priceListId, productId);
  const e = priceCache.get(k);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    priceCache.delete(k);
    return null;
  }
  return e.value;
}

function cacheSet(priceListId: string, productId: string, value: number) {
  const k = cacheKey(priceListId, productId);
  priceCache.set(k, { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
}

function cacheInvalidate(priceListId: string, productId: string) {
  priceCache.delete(cacheKey(priceListId, productId));
}

function cacheInvalidateByPriceList(priceListId: string) {
  const prefix = `${priceListId}:`;
  for (const k of priceCache.keys()) {
    if (k.startsWith(prefix)) priceCache.delete(k);
  }
}

function normalizeSearch(s?: string) {
  const q = (s ?? "").trim();
  return q ? q : null;
}

async function assertPriceListExists(id: string) {
  const item = await prisma.priceList.findFirst({
    where: { id, deletedAt: null },
  });
  if (!item) {
    throw new AppError("Price list not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return item;
}

async function assertItemExists(itemId: string) {
  const item = await prisma.priceListItem.findUnique({
    where: { id: itemId },
  });
  if (!item) {
    throw new AppError("Price list item not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
  }
  return item;
}

export const pricelistsService = {
  list: async (q: PricelistsListQuery) => {
    const search = normalizeSearch(q.q);

    const where: any = {
      deletedAt: null,
      ...(q.status === "active" ? { isActive: true } : {}),
      ...(q.status === "inactive" ? { isActive: false } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { name: { contains: search } },
            ],
          }
        : {}),
    };

    const items = await prisma.priceList.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      include: {
        _count: { select: { items: true } },
      },
    });

    return { items };
  },

  get: async (id: string) => {
    const item = await prisma.priceList.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          orderBy: { createdAt: "desc" },
          include: { product: true },
        },
      },
    });

    if (!item) {
      throw new AppError("Price list not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    return { item };
  },

  create: async (data: PriceListCreateInput) => {
    const code = data.code.trim().toUpperCase();

    const exists = await prisma.priceList.findFirst({
      where: { code, deletedAt: null },
      select: { id: true },
    });
    if (exists) {
      throw new AppError("Price list code already exists", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { code },
      });
    }

    const item = await prisma.priceList.create({
      data: {
        code,
        name: data.name.trim(),
        note: data.note?.trim() || null,
        isActive: data.isActive ?? true,
      },
      include: {
        items: { include: { product: true }, orderBy: { createdAt: "desc" } },
      },
    });

    return { item };
  },

  update: async (id: string, data: PriceListUpdateInput) => {
    await assertPriceListExists(id);

    const item = await prisma.priceList.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.note !== undefined ? { note: data.note?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.deletedAt !== undefined ? { deletedAt: data.deletedAt ?? null } : {}),
      },
      include: {
        items: { include: { product: true }, orderBy: { createdAt: "desc" } },
      },
    });

    // cache: invalidate all entries for this price list (status/name changes can coexist, but on delete it's safer)
    if (data.deletedAt !== undefined || data.isActive !== undefined) {
      cacheInvalidateByPriceList(id);
    }

    return { item };
  },

  /**
   * Ajoute (ou remplace) un prix produit dans une grille.
   * Pro: upsert sur @@unique([priceListId, productId])
   */
  addItem: async (priceListId: string, input: PriceListItemCreateInput) => {
    await assertPriceListExists(priceListId);

    // vérifier que le produit existe (sinon Prisma remontera une erreur brute)
    const product = await prisma.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new AppError("Product not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    const item = await prisma.priceListItem.upsert({
      where: { priceListId_productId: { priceListId, productId: input.productId } },
      create: {
        priceListId,
        productId: input.productId,
        unitPrice: input.unitPrice,
      },
      update: {
        unitPrice: input.unitPrice,
      },
      include: {
        product: true,
        priceList: true,
      },
    });

    // cache: warm + ensure freshness
    cacheSet(priceListId, input.productId, item.unitPrice);

    return { item };
  },

  updateItem: async (priceListId: string, itemId: string, input: PriceListItemUpdateInput) => {
    await assertPriceListExists(priceListId);
    const existing = await assertItemExists(itemId);

    // sécurité: empêcher de modifier un item qui n'appartient pas à cette grille
    if (existing.priceListId !== priceListId) {
      throw new AppError("Item does not belong to price list", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { priceListId, itemId },
      });
    }

    const item = await prisma.priceListItem.update({
      where: { id: itemId },
      data: { unitPrice: input.unitPrice },
      include: { product: true, priceList: true },
    });

    // cache: warm + ensure freshness
    cacheSet(priceListId, existing.productId, item.unitPrice);

    return { item };
  },

  deleteItem: async (priceListId: string, itemId: string) => {
    await assertPriceListExists(priceListId);
    const existing = await assertItemExists(itemId);

    if (existing.priceListId !== priceListId) {
      throw new AppError("Item does not belong to price list", {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { priceListId, itemId },
      });
    }

    await prisma.priceListItem.delete({ where: { id: itemId } });

    // cache: invalidate
    cacheInvalidate(priceListId, existing.productId);

    return { ok: true };
  },

  /**
   * Helper (STRICT, BATCH): retourne les prix unitaires d'une liste de produits depuis une grille.
   * - priceListId requis
   * - chaque productId doit avoir un item dans la grille
   * => sinon erreur 409 (métier) avec la liste des productIds manquants
   */
  getEffectivePricesBatch: async (
    productIds: string[],
    priceListId: string | null | undefined
  ): Promise<Map<string, number>> => {
    if (!priceListId) {
      throw new AppError("Grille tarifaire manquante", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { productIds, priceListId: priceListId ?? null },
      });
    }

    const ids = Array.from(
      new Set(
        (productIds ?? [])
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
      )
    );

    const map = new Map<string, number>();
    if (!ids.length) return map;

    // 1) try cache first
    const missingFromCache: string[] = [];
    for (const pid of ids) {
      const cached = cacheGet(priceListId, pid);
      if (cached != null) {
        map.set(pid, cached);
      } else {
        missingFromCache.push(pid);
      }
    }

    // 2) fetch only missing
    if (missingFromCache.length) {
      const rows = await prisma.priceListItem.findMany({
        where: {
          priceListId,
          productId: { in: missingFromCache },
        },
        select: {
          productId: true,
          unitPrice: true,
        },
      });

      for (const r of rows) {
        map.set(r.productId, r.unitPrice);
        cacheSet(priceListId, r.productId, r.unitPrice);
      }
    }

    const missing = ids.filter((id) => !map.has(id));
    if (missing.length) {
      throw new AppError("Tarif manquant pour le produit", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { priceListId, missingProductIds: missing },
      });
    }

    return map;
  },

  /**
   * Helper (STRICT): retourne le prix d'un produit depuis une grille tarifaire.
   * Règles:
   * - priceListId requis
   * - le produit doit exister (et pas supprimé)
   * - un item (PriceListItem) doit exister pour (priceListId, productId)
   * => sinon erreur 409 (métier) pour éviter des ventes avec prix implicites
   */
  getEffectivePrice: async (productId: string, priceListId: string | null | undefined) => {
    // 0) grille requise
    if (!priceListId) {
      throw new AppError("Grille tarifaire manquante", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { productId, priceListId: priceListId ?? null },
      });
    }

    const cached = cacheGet(priceListId, productId);
    if (cached != null) return cached;

    // 1) produit doit exister
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new AppError("Product not found", { status: 404, code: ERROR_CODES.NOT_FOUND });
    }

    // 2) item doit exister dans la grille
    const pli = await prisma.priceListItem.findUnique({
      where: { priceListId_productId: { priceListId, productId } },
      select: { unitPrice: true },
    });

    if (!pli) {
      throw new AppError("Tarif manquant pour le produit", {
        status: 409,
        code: ERROR_CODES.VALIDATION_ERROR,
        details: { productId, priceListId },
      });
    }

    cacheSet(priceListId, productId, pli.unitPrice);
    return pli.unitPrice;
  },
};