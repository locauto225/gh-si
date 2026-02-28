"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
const pricelists_service_1 = require("../pricelists/pricelists.service");
const SALE_STATUSES = ["DRAFT", "POSTED", "CANCELLED"];
function makeSaleNumber(now = new Date()) {
    const y = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `SA-${y}${mm}${dd}-${rand}`;
}
function normalizeStatusFilter(raw) {
    const s = (raw ?? "").trim();
    if (!s || s === "all")
        return null;
    const parts = s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    const out = [];
    for (const p of parts) {
        if (!SALE_STATUSES.includes(p)) {
            throw new errors_1.AppError("Invalid status filter", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { status: p, allowed: [...SALE_STATUSES, "all"] },
            });
        }
        out.push(p);
    }
    // uniq
    return Array.from(new Set(out));
}
async function assertSaleExists(id) {
    const sale = await prisma_1.prisma.sale.findUnique({
        where: { id },
        include: {
            lines: { include: { product: true } },
        },
    });
    if (!sale) {
        throw new errors_1.AppError("Sale not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    return sale;
}
exports.salesService = {
    list: async (q) => {
        const statuses = normalizeStatusFilter(q.status);
        const where = {
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
        const items = await prisma_1.prisma.sale.findMany({
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
    get: async (id) => {
        const item = await prisma_1.prisma.sale.findUnique({
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
            throw new errors_1.AppError("Sale not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        if (item.channel !== "STORE") {
            throw new errors_1.AppError("Sale not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    quote: async (data) => {
        // --- POS only
        const storeId = String(data.storeId);
        const fulfillment = data.fulfillment;
        const shippingFee = fulfillment === "PICKUP" ? 0 : Math.trunc(data.shippingFee ?? 0);
        // --- Récupérer la grille tarifaire effective (POS = magasin)
        const store = await prisma_1.prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, warehouseId: true, priceListId: true },
        });
        if (!store) {
            throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        if (store.warehouseId !== data.warehouseId) {
            throw new errors_1.AppError("Incohérence entre store et entrepôt", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { storeWarehouseId: store.warehouseId, warehouseId: data.warehouseId },
            });
        }
        const effectivePriceListId = store.priceListId ?? null;
        if (!effectivePriceListId) {
            throw new errors_1.AppError("Grille tarifaire manquante", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
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
        const pricesMap = await pricelists_service_1.pricelistsService.getEffectivePricesBatch(autoProductIds, effectivePriceListId);
        const lines = data.lines.map((l) => {
            const provided = l.unitPrice;
            if (typeof provided === "number" && Number.isFinite(provided)) {
                return {
                    productId: l.productId,
                    qty: l.qty,
                    unitPrice: Math.trunc(provided),
                    source: "MANUAL",
                };
            }
            const fromGrid = pricesMap.get(l.productId);
            // sécurité: normalement jamais null car le batch throw si manquant
            if (fromGrid == null) {
                throw new errors_1.AppError("Tarif manquant pour le produit", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { productId: l.productId, priceListId: effectivePriceListId },
                });
            }
            return {
                productId: l.productId,
                qty: l.qty,
                unitPrice: Math.trunc(fromGrid),
                source: "PRICELIST",
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
    create: async (data) => {
        const number = makeSaleNumber();
        // V1: on accepte clientId null (vente comptoir)
        const clientId = data.clientId ? String(data.clientId) : null;
        // --- POS only
        const storeId = String(data.storeId);
        const fulfillment = data.fulfillment;
        const shippingFee = fulfillment === "PICKUP" ? 0 : Math.trunc(data.shippingFee ?? 0);
        // --- Récupérer la grille tarifaire effective (POS = magasin)
        const store = await prisma_1.prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, warehouseId: true, priceListId: true },
        });
        if (!store) {
            throw new errors_1.AppError("Store not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        if (store.warehouseId !== data.warehouseId) {
            throw new errors_1.AppError("Incohérence entre store et entrepôt", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { storeWarehouseId: store.warehouseId, warehouseId: data.warehouseId },
            });
        }
        const effectivePriceListId = store.priceListId ?? null;
        if (!effectivePriceListId) {
            throw new errors_1.AppError("Grille tarifaire manquante", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
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
        const pricesMap = await pricelists_service_1.pricelistsService.getEffectivePricesBatch(autoProductIds, effectivePriceListId);
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
                throw new errors_1.AppError("Tarif manquant pour le produit", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
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
        const item = await prisma_1.prisma.sale.create({
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
    setStatus: async (id, input) => {
        const sale = await assertSaleExists(id);
        const next = input.status;
        const current = sale.status;
        const allowed = {
            DRAFT: ["POSTED", "CANCELLED"],
            POSTED: [],
            CANCELLED: [],
        };
        if (!allowed[current].includes(next)) {
            throw new errors_1.AppError("Transition de statut interdite", {
                status: 400,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                details: { from: current, to: next, allowed: allowed[current] },
            });
        }
        // Si on poste: créer des mouvements OUT + mettre à jour StockItem en transaction
        if (next === "POSTED") {
            const posted = await prisma_1.prisma.$transaction(async (tx) => {
                // 1) vérifier stock suffisant pour chaque ligne
                for (const line of sale.lines) {
                    const onHand = await tx.stockItem.findUnique({
                        where: { warehouseId_productId: { warehouseId: sale.warehouseId, productId: line.productId } },
                    });
                    const available = onHand?.quantity ?? 0;
                    if (line.qty > available) {
                        throw (0, errors_1.insufficientStockError)({ available, requested: line.qty });
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
                        throw (0, errors_1.insufficientStockError)({
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
                let posReceipt = null;
                if (!sale.storeId) {
                    throw new errors_1.AppError("storeId manquant sur la vente POS", {
                        status: 500,
                        code: errors_1.ERROR_CODES.INTERNAL_ERROR,
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
                        storeId: sale.storeId,
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
        const item = await prisma_1.prisma.sale.update({
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
