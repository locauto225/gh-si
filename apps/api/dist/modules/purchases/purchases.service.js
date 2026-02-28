"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchasesService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function normalizeStr(v) {
    if (v === undefined || v === null)
        return null;
    const s = String(v).trim();
    return s ? s : null;
}
function makePoNumber() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    // V1: unique “assez” pour démarrer (tu pourras passer à une séquence plus tard)
    // On augmente légèrement l’entropie pour réduire encore le risque de doublon.
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PO-${yyyy}${mm}${dd}-${rnd}`;
}
async function createPurchaseOrderWithUniqueNumber(tx, data) {
    // Petit retry en cas de rare collision du numéro (contrainte unique)
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const item = await tx.purchaseOrder.create({
                data: {
                    number: makePoNumber(),
                    status: "DRAFT",
                    supplierId: data.supplierId,
                    warehouseId: data.warehouseId,
                    note: data.note,
                    lines: { create: data.lines },
                },
                include: {
                    supplier: true,
                    warehouse: true,
                    lines: { include: { product: true }, orderBy: { createdAt: "asc" } },
                },
            });
            return item;
        }
        catch (e) {
            // Prisma unique constraint violation
            if (e?.code === "P2002")
                continue;
            throw e;
        }
    }
    throw new errors_1.AppError("Impossible de générer un numéro de bon de commande unique", {
        status: 500,
        code: errors_1.ERROR_CODES.INTERNAL_ERROR,
    });
}
exports.purchasesService = {
    list: async (q) => {
        // status: "all" | single | CSV | array
        let whereStatus = {};
        const rawStatus = q.status;
        if (rawStatus && rawStatus !== "all") {
            const statuses = Array.isArray(rawStatus)
                ? rawStatus
                : String(rawStatus)
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
            if (statuses.length === 1) {
                whereStatus = { status: statuses[0] };
            }
            else if (statuses.length > 1) {
                whereStatus = { status: { in: statuses } };
            }
        }
        const qStr = q.q?.trim();
        const qLower = qStr ? qStr.toLowerCase() : null;
        const items = await prisma_1.prisma.purchaseOrder.findMany({
            take: q.limit,
            orderBy: { createdAt: "desc" },
            where: {
                ...whereStatus,
                ...(qStr
                    ? {
                        OR: [
                            { number: { contains: qStr } }, // numéro BC (case-sensitive OK en SQLite)
                            {
                                supplier: {
                                    // on suppose que Supplier.nameSearch existe (comme on vient de faire)
                                    nameSearch: { contains: qLower },
                                },
                            },
                        ],
                    }
                    : {}),
            },
            include: {
                supplier: true,
                warehouse: true,
                lines: {
                    include: { product: true },
                    orderBy: { createdAt: "asc" },
                },
            },
        });
        return { items };
    },
    get: async (id) => {
        const item = await prisma_1.prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                warehouse: true,
                lines: {
                    include: { product: true },
                    orderBy: { createdAt: "asc" },
                },
            },
        });
        if (!item) {
            throw new errors_1.AppError("Bon de commande introuvable", {
                status: 404,
                code: errors_1.ERROR_CODES.NOT_FOUND,
            });
        }
        return { item };
    },
    create: async (data) => {
        const note = normalizeStr(data.note);
        // V1: on évite les doublons “mêmes produits” en regroupant si besoin
        const merged = new Map();
        for (const l of data.lines) {
            const prev = merged.get(l.productId);
            if (!prev)
                merged.set(l.productId, { ...l });
            else {
                // si le même produit est envoyé 2 fois, on additionne la quantité, on garde le dernier prix
                merged.set(l.productId, {
                    productId: l.productId,
                    qtyOrdered: prev.qtyOrdered + l.qtyOrdered,
                    unitPrice: l.unitPrice,
                });
            }
        }
        const lines = [...merged.values()].map((l) => ({
            productId: l.productId,
            qtyOrdered: l.qtyOrdered,
            unitPrice: l.unitPrice,
            qtyReceived: 0,
        }));
        const item = await createPurchaseOrderWithUniqueNumber(prisma_1.prisma, {
            supplierId: data.supplierId,
            warehouseId: data.warehouseId,
            note,
            lines,
        });
        return { item };
    },
    setStatus: async (id, data) => {
        const existing = await prisma_1.prisma.purchaseOrder.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!existing) {
            throw new errors_1.AppError("Bon de commande introuvable", {
                status: 404,
                code: errors_1.ERROR_CODES.NOT_FOUND,
            });
        }
        // Règles “pro” V1 : transitions contrôlées
        // DRAFT -> ORDERED | CANCELLED
        // ORDERED -> CANCELLED (le passage à RECEIVED se fait via /receive)
        // RECEIVED / CANCELLED -> locked
        if (existing.status === "RECEIVED") {
            throw new errors_1.AppError("Un bon déjà reçu ne peut plus changer de statut", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
            });
        }
        if (existing.status === "CANCELLED") {
            throw new errors_1.AppError("Un bon annulé ne peut plus changer de statut", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
            });
        }
        if (data.status === "RECEIVED") {
            throw new errors_1.AppError("Le statut RECEIVED est géré automatiquement à la réception (utilise /purchases/:id/receive)", {
                status: 409,
                code: errors_1.ERROR_CODES.VALIDATION_ERROR,
            });
        }
        if (existing.status === "DRAFT") {
            if (data.status !== "ORDERED" && data.status !== "CANCELLED") {
                throw new errors_1.AppError("Transition de statut non autorisée", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { from: existing.status, to: data.status },
                });
            }
        }
        if (existing.status === "ORDERED") {
            if (data.status !== "CANCELLED" && data.status !== "ORDERED") {
                throw new errors_1.AppError("Transition de statut non autorisée", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { from: existing.status, to: data.status },
                });
            }
        }
        const item = await prisma_1.prisma.purchaseOrder.update({
            where: { id },
            data: {
                status: data.status,
            },
            include: {
                supplier: true,
                warehouse: true,
                lines: { include: { product: true }, orderBy: { createdAt: "asc" } },
            },
        });
        return { item };
    },
    /**
     * Réception: augmente qtyReceived sur les lignes + crée des mouvements stock IN
     * - Autorisé si status != CANCELLED
     * - Le stock est dans l'entrepôt du BC
     */
    receive: async (id, input) => {
        const note = normalizeStr(input.note);
        return prisma_1.prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.findUnique({
                where: { id },
                include: {
                    supplier: true,
                    warehouse: true,
                    lines: true,
                },
            });
            if (!po) {
                throw new errors_1.AppError("Bon de commande introuvable", {
                    status: 404,
                    code: errors_1.ERROR_CODES.NOT_FOUND,
                });
            }
            if (po.status === "CANCELLED") {
                throw new errors_1.AppError("Bon de commande annulé : réception impossible", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                });
            }
            // Pro: réception normalement uniquement si ORDERED.
            // Filet de sécurité V1: si le SI a été mal utilisé et que le BC est resté en DRAFT,
            // on le bascule automatiquement en ORDERED (audit minimal via la note).
            if (po.status === "DRAFT") {
                await tx.purchaseOrder.update({
                    where: { id: po.id },
                    data: {
                        status: "ORDERED",
                        note: [
                            normalizeStr(po.note),
                            "[AUTO] Passage DRAFT -> ORDERED lors de la réception",
                        ]
                            .filter(Boolean)
                            .join("\n"),
                    },
                });
                po.status = "ORDERED";
            }
            if (po.status !== "ORDERED" && po.status !== "PARTIALLY_RECEIVED") {
                throw new errors_1.AppError("Réception impossible : le bon doit être ORDERED ou PARTIALLY_RECEIVED", {
                    status: 409,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { status: po.status },
                });
            }
            // map lignes existantes
            const lineByProduct = new Map(po.lines.map((l) => [l.productId, l]));
            // valider réception
            const toReceive = [];
            for (const l of input.lines) {
                const qty = Number(l.qtyReceived);
                if (!Number.isFinite(qty) || qty < 0) {
                    throw new errors_1.AppError("Quantité reçue invalide", {
                        status: 400,
                        code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    });
                }
                if (qty === 0)
                    continue;
                const existingLine = lineByProduct.get(l.productId);
                if (!existingLine) {
                    throw new errors_1.AppError("Produit non présent dans le bon de commande", {
                        status: 400,
                        code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                        details: { productId: l.productId },
                    });
                }
                const remaining = existingLine.qtyOrdered - existingLine.qtyReceived;
                if (qty > remaining) {
                    throw new errors_1.AppError("Réception > quantité restante", {
                        status: 409,
                        code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                        details: { productId: l.productId, remaining, requested: qty },
                    });
                }
                toReceive.push({ productId: l.productId, qty });
            }
            if (toReceive.length === 0) {
                throw new errors_1.AppError("Rien à réceptionner", {
                    status: 400,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                });
            }
            // appliquer qtyReceived + stock moves + stock items
            for (const r of toReceive) {
                const line = lineByProduct.get(r.productId);
                await tx.purchaseOrderLine.update({
                    where: { id: line.id },
                    data: { qtyReceived: line.qtyReceived + r.qty },
                });
                // StockMove IN
                await tx.stockMove.create({
                    data: {
                        kind: "IN",
                        warehouseId: po.warehouseId,
                        productId: r.productId,
                        qtyDelta: r.qty,
                        refType: "PURCHASE_RECEIPT",
                        refId: po.id,
                        note,
                    },
                });
                // StockItem upsert (onhand)
                await tx.stockItem.upsert({
                    where: {
                        warehouseId_productId: {
                            warehouseId: po.warehouseId,
                            productId: r.productId,
                        },
                    },
                    create: {
                        warehouseId: po.warehouseId,
                        productId: r.productId,
                        quantity: r.qty,
                    },
                    update: {
                        quantity: { increment: r.qty },
                    },
                });
            }
            // recalcul du statut: si tout reçu -> RECEIVED, sinon ORDERED (si pas DRAFT)
            const refreshed = await tx.purchaseOrder.findUnique({
                where: { id: po.id },
                include: {
                    supplier: true,
                    warehouse: true,
                    lines: { include: { product: true }, orderBy: { createdAt: "asc" } },
                },
            });
            if (!refreshed) {
                throw new errors_1.AppError("Erreur interne (refresh)", {
                    status: 500,
                    code: errors_1.ERROR_CODES.INTERNAL_ERROR,
                });
            }
            const noneReceived = refreshed.lines.every((l) => l.qtyReceived === 0);
            const allReceived = refreshed.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
            const someReceived = !noneReceived && !allReceived;
            // Après réception :
            // - si tout est reçu => RECEIVED
            // - si partiel => PARTIALLY_RECEIVED
            // - sinon (filet de sécurité) => ORDERED
            const finalStatus = allReceived
                ? "RECEIVED"
                : someReceived
                    ? "PARTIALLY_RECEIVED"
                    : "ORDERED";
            const item = finalStatus === refreshed.status
                ? refreshed
                : await tx.purchaseOrder.update({
                    where: { id: refreshed.id },
                    data: { status: finalStatus },
                    include: {
                        supplier: true,
                        warehouse: true,
                        lines: { include: { product: true }, orderBy: { createdAt: "asc" } },
                    },
                });
            return { item };
        });
    },
};
