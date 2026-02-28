"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricelistsService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
// --- Mini cache TTL (in-memory) for effective prices
// Key: `${priceListId}:${productId}`
const PRICE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const priceCache = new Map();
function cacheKey(priceListId, productId) {
    return `${priceListId}:${productId}`;
}
function cacheGet(priceListId, productId) {
    const k = cacheKey(priceListId, productId);
    const e = priceCache.get(k);
    if (!e)
        return null;
    if (Date.now() > e.expiresAt) {
        priceCache.delete(k);
        return null;
    }
    return e.value;
}
function cacheSet(priceListId, productId, value) {
    const k = cacheKey(priceListId, productId);
    priceCache.set(k, { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
}
function cacheInvalidate(priceListId, productId) {
    priceCache.delete(cacheKey(priceListId, productId));
}
function cacheInvalidateByPriceList(priceListId) {
    const prefix = `${priceListId}:`;
    for (const k of priceCache.keys()) {
        if (k.startsWith(prefix))
            priceCache.delete(k);
    }
}
function normalizeSearch(s) {
    const q = (s ?? "").trim();
    return q ? q : null;
}
async function assertPriceListExists(id) {
    const item = await prisma_1.prisma.priceList.findFirst({
        where: { id, deletedAt: null },
    });
    if (!item) {
        throw new errors_1.AppError("Price list not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    return item;
}
async function assertItemExists(itemId) {
    const item = await prisma_1.prisma.priceListItem.findUnique({
        where: { id: itemId },
    });
    if (!item) {
        throw new errors_1.AppError("Price list item not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    return item;
}
exports.pricelistsService = {
    list: async (q) => {
        const search = normalizeSearch(q.q);
        const where = {
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
        const items = await prisma_1.prisma.priceList.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: q.limit,
            include: {
                _count: { select: { items: true } },
            },
        });
        return { items };
    },
    get: async (id) => {
        const item = await prisma_1.prisma.priceList.findFirst({
            where: { id, deletedAt: null },
            include: {
                items: {
                    orderBy: { createdAt: "desc" },
                    include: { product: true },
                },
            },
        });
        if (!item) {
            throw new errors_1.AppError("Price list not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    create: async (data) => {
        const code = data.code.trim().toUpperCase();
        const exists = await prisma_1.prisma.priceList.findFirst({
            where: { code, deletedAt: null },
            select: { id: true },
        });
        if (exists) {
            throw new errors_1.AppError("Price list code already exists", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { code },
            });
        }
        const item = await prisma_1.prisma.priceList.create({
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
    update: async (id, data) => {
        await assertPriceListExists(id);
        const item = await prisma_1.prisma.priceList.update({
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
    addItem: async (priceListId, input) => {
        await assertPriceListExists(priceListId);
        // vérifier que le produit existe (sinon Prisma remontera une erreur brute)
        const product = await prisma_1.prisma.product.findFirst({
            where: { id: input.productId, deletedAt: null },
            select: { id: true },
        });
        if (!product) {
            throw new errors_1.AppError("Product not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        const item = await prisma_1.prisma.priceListItem.upsert({
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
    updateItem: async (priceListId, itemId, input) => {
        await assertPriceListExists(priceListId);
        const existing = await assertItemExists(itemId);
        // sécurité: empêcher de modifier un item qui n'appartient pas à cette grille
        if (existing.priceListId !== priceListId) {
            throw new errors_1.AppError("Item does not belong to price list", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { priceListId, itemId },
            });
        }
        const item = await prisma_1.prisma.priceListItem.update({
            where: { id: itemId },
            data: { unitPrice: input.unitPrice },
            include: { product: true, priceList: true },
        });
        // cache: warm + ensure freshness
        cacheSet(priceListId, existing.productId, item.unitPrice);
        return { item };
    },
    deleteItem: async (priceListId, itemId) => {
        await assertPriceListExists(priceListId);
        const existing = await assertItemExists(itemId);
        if (existing.priceListId !== priceListId) {
            throw new errors_1.AppError("Item does not belong to price list", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { priceListId, itemId },
            });
        }
        await prisma_1.prisma.priceListItem.delete({ where: { id: itemId } });
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
    getEffectivePricesBatch: async (productIds, priceListId) => {
        if (!priceListId) {
            throw new errors_1.AppError("Grille tarifaire manquante", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { productIds, priceListId: priceListId ?? null },
            });
        }
        const ids = Array.from(new Set((productIds ?? [])
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)));
        const map = new Map();
        if (!ids.length)
            return map;
        // 1) try cache first
        const missingFromCache = [];
        for (const pid of ids) {
            const cached = cacheGet(priceListId, pid);
            if (cached != null) {
                map.set(pid, cached);
            }
            else {
                missingFromCache.push(pid);
            }
        }
        // 2) fetch only missing
        if (missingFromCache.length) {
            const rows = await prisma_1.prisma.priceListItem.findMany({
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
            throw new errors_1.AppError("Tarif manquant pour le produit", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
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
    getEffectivePrice: async (productId, priceListId) => {
        // 0) grille requise
        if (!priceListId) {
            throw new errors_1.AppError("Grille tarifaire manquante", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { productId, priceListId: priceListId ?? null },
            });
        }
        const cached = cacheGet(priceListId, productId);
        if (cached != null)
            return cached;
        // 1) produit doit exister
        const product = await prisma_1.prisma.product.findFirst({
            where: { id: productId, deletedAt: null },
            select: { id: true },
        });
        if (!product) {
            throw new errors_1.AppError("Product not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        // 2) item doit exister dans la grille
        const pli = await prisma_1.prisma.priceListItem.findUnique({
            where: { priceListId_productId: { priceListId, productId } },
            select: { unitPrice: true },
        });
        if (!pli) {
            throw new errors_1.AppError("Tarif manquant pour le produit", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { productId, priceListId },
            });
        }
        cacheSet(priceListId, productId, pli.unitPrice);
        return pli.unitPrice;
    },
};
