"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
const errors_2 = require("../../lib/errors");
function assertKindDelta(kind, qtyDelta) {
    if (!Number.isInteger(qtyDelta) || qtyDelta === 0) {
        throw new errors_2.AppError("Invalid qtyDelta", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "qtyDelta", reason: "must be a non-zero integer" },
        });
    }
    if (kind === "IN" && qtyDelta <= 0) {
        throw new errors_2.AppError("Invalid qtyDelta for IN", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "qtyDelta", kind, reason: "IN requires qtyDelta > 0" },
        });
    }
    if (kind === "OUT" && qtyDelta >= 0) {
        throw new errors_2.AppError("Invalid qtyDelta for OUT", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "qtyDelta", kind, reason: "OUT requires qtyDelta < 0" },
        });
    }
    if (kind === "ADJUST" && qtyDelta === 0) {
        throw new errors_2.AppError("Invalid qtyDelta for ADJUST", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "qtyDelta", kind, reason: "ADJUST requires qtyDelta != 0" },
        });
    }
}
function assertTransfer(data) {
    if (!data.fromWarehouseId) {
        throw new errors_2.AppError("Invalid fromWarehouseId", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "fromWarehouseId", reason: "required" },
        });
    }
    if (!data.toWarehouseId) {
        throw new errors_2.AppError("Invalid toWarehouseId", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "toWarehouseId", reason: "required" },
        });
    }
    if (data.fromWarehouseId === data.toWarehouseId) {
        throw new errors_2.AppError("Invalid transfer warehouses", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "toWarehouseId", reason: "must be different from fromWarehouseId" },
        });
    }
    // New payload: lines: [{ productId, qty, note? }]
    const anyData = data;
    const lines = Array.isArray(anyData.lines)
        ? anyData.lines
        : [];
    // Backward compat: old payload productId + qty
    const legacyProductId = typeof anyData.productId === "string" ? anyData.productId : "";
    const legacyQty = typeof anyData.qty === "number" ? anyData.qty : undefined;
    const effectiveLines = lines.length
        ? lines
        : legacyProductId
            ? [{ productId: legacyProductId, qty: legacyQty }]
            : [];
    if (!effectiveLines.length) {
        throw new errors_2.AppError("Invalid lines", {
            status: 400,
            code: errors_2.ERROR_CODES.VALIDATION_ERROR,
            details: { field: "lines", reason: "required" },
        });
    }
    // Basic validation + no duplicates
    const seen = new Set();
    for (let i = 0; i < effectiveLines.length; i++) {
        const l = effectiveLines[i];
        const pid = String(l.productId ?? "").trim();
        if (!pid) {
            throw new errors_2.AppError("Invalid productId", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: `lines[${i}].productId`, reason: "required" },
            });
        }
        if (!Number.isInteger(l.qty) || l.qty <= 0) {
            throw new errors_2.AppError("Invalid qty", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: `lines[${i}].qty`, reason: "must be an integer > 0" },
            });
        }
        if (seen.has(pid)) {
            throw new errors_2.AppError("Duplicate productId", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "lines", reason: "duplicate productId", productId: pid },
            });
        }
        seen.add(pid);
    }
}
function normalizeTransferLines(data) {
    const anyData = data;
    const linesInput = Array.isArray(anyData.lines)
        ? anyData.lines
        : [];
    // Backward compat: old payload productId + qty
    const legacyProductId = typeof anyData.productId === "string" ? anyData.productId : "";
    const legacyQty = typeof anyData.qty === "number" ? anyData.qty : undefined;
    const normalizedLines = linesInput.length
        ? linesInput.map((l) => ({
            productId: String(l.productId).trim(),
            qty: Number(l.qty),
            note: l.note ?? null,
        }))
        : legacyProductId
            ? [{ productId: String(legacyProductId).trim(), qty: Number(legacyQty), note: anyData.note ?? null }]
            : [];
    return normalizedLines;
}
function sumReceived(lines) {
    return (lines ?? []).reduce((s, l) => s + (Number(l.qtyReceived ?? 0) || 0), 0);
}
function isFullyReceived(lines) {
    return (lines ?? []).every((l) => (Number(l.qtyReceived ?? 0) || 0) >= (Number(l.qty ?? 0) || 0));
}
// Helper to log a delivery event if transfer is linked to a delivery
async function addDeliveryEventForTransferTx(tx, transferId, input) {
    // 1 Delivery <-> 1 Transfer (Delivery.transferId is @unique)
    const delivery = await tx.delivery.findUnique({
        where: { transferId },
        select: { id: true, status: true },
    });
    if (!delivery)
        return;
    await tx.deliveryEvent.create({
        data: {
            deliveryId: delivery.id,
            type: input.type,
            status: delivery.status,
            message: input.message,
            meta: input.meta !== undefined ? JSON.stringify(input.meta) : null,
        },
    });
}
const stockTransferWithLinesInclude = {
    fromWarehouse: true,
    toWarehouse: true,
    lines: {
        orderBy: { createdAt: "asc" },
        include: { product: true },
    },
};
function mapTransfer(t) {
    return {
        id: t.id,
        status: t.status,
        note: t.note ?? null,
        shippedAt: t.shippedAt ?? null,
        receivedAt: t.receivedAt ?? null,
        createdAt: t.createdAt,
        journeyId: t.journeyId ?? null,
        purpose: t.purpose ?? null,
        fromWarehouse: t.fromWarehouse,
        toWarehouse: t.toWarehouse,
        lines: (t.lines ?? []).map((l) => ({
            id: l.id,
            productId: l.productId,
            product: l.product,
            qty: l.qty,
            qtyReceived: l.qtyReceived ?? 0,
            note: l.note ?? null,
        })),
    };
}
exports.stockService = {
    /**
     * Créer un transfert DRAFT destiné à être lié à une livraison (BL).
     * - Centralise la logique "delivery -> transfer" (plus de duplication dans deliveries).
     * - Ne bouge pas le stock (workflow DRAFT -> SHIPPED -> RECEIVE).
     */
    createDeliveryTransferDraft: async (input) => {
        return exports.stockService.createTransferDraft({
            fromWarehouseId: input.fromWarehouseId,
            toWarehouseId: input.toWarehouseId,
            note: input.note ?? null,
            // champs ERP optionnels (déjà supportés via (data as any) dans createTransferDraft)
            purpose: input.purpose ?? "INTERNAL_DELIVERY",
            journeyId: input.journeyId ?? null,
            lines: input.lines,
        });
    },
    /**
     * Liste du stock d'un entrepôt:
     * - retourne tous les produits actifs
     * - quantité = StockItem.quantity si existe sinon 0
     */
    listByWarehouse: async (warehouseId) => {
        const [products, stockItems] = await Promise.all([
            prisma_1.prisma.product.findMany({
                where: { isActive: true },
                orderBy: { name: "asc" },
                include: { category: true },
            }),
            prisma_1.prisma.stockItem.findMany({
                where: { warehouseId },
                select: { productId: true, quantity: true },
            }),
        ]);
        const map = new Map(stockItems.map((s) => [s.productId, s.quantity]));
        return products.map((p) => ({
            product: p,
            quantity: map.get(p.id) ?? 0,
        }));
    },
    /**
     * Quantité actuelle d'un produit dans un entrepôt.
     * Retourne 0 si aucune ligne StockItem n'existe.
     */
    getQty: async (warehouseId, productId) => {
        const row = await prisma_1.prisma.stockItem.findUnique({
            where: { warehouseId_productId: { warehouseId, productId } },
            select: { quantity: true },
        });
        return row?.quantity ?? 0;
    },
    /**
     * Quantités batch pour un entrepôt (optimisé).
     * - 1 seule requête StockItem (warehouseId + productId IN ...)
     * - retourne la liste demandée avec quantity=0 si absent.
     */
    getQtyBatch: async (warehouseId, productIds) => {
        const ids = Array.from(new Set((productIds ?? []).map((x) => String(x).trim()).filter(Boolean)));
        if (!warehouseId || ids.length === 0)
            return [];
        const rows = await prisma_1.prisma.stockItem.findMany({
            where: {
                warehouseId,
                productId: { in: ids },
            },
            select: { productId: true, quantity: true },
        });
        const map = new Map(rows.map((r) => [r.productId, r.quantity]));
        return ids.map((productId) => ({
            productId,
            quantity: map.get(productId) ?? 0,
        }));
    },
    /**
     * Créer un mouvement et mettre à jour le solde (StockItem) de façon atomique.
     * V1: on refuse si le stock devient négatif.
     */
    createMove: async (data) => {
        assertKindDelta(data.kind, data.qtyDelta);
        return prisma_1.prisma.$transaction(async (tx) => {
            // 1) vérifier l'entrepôt et le produit (éviter move sur supprimé)
            const [warehouse, product] = await Promise.all([
                tx.warehouse.findFirst({
                    where: { id: data.warehouseId, deletedAt: null },
                    select: { id: true, kind: true },
                }),
                tx.product.findFirst({
                    where: { id: data.productId, deletedAt: null },
                    select: { id: true },
                }),
            ]);
            if (!warehouse) {
                throw new errors_2.AppError("Warehouse not found", {
                    status: 404,
                    code: errors_2.ERROR_CODES.NOT_FOUND,
                });
            }
            if (!product) {
                throw new errors_2.AppError("Product not found", {
                    status: 404,
                    code: errors_2.ERROR_CODES.NOT_FOUND,
                });
            }
            // garde-fou métier: certains refType ne doivent pas être utilisés sur un STORE
            // (ex: réception achat) — sinon on pollue le flux "magasin".
            if (warehouse.kind === "STORE") {
                const ref = (data.refType ?? "").toUpperCase();
                const DISALLOWED_ON_STORE = new Set([
                    "PURCHASE",
                    "PURCHASE_ORDER",
                    "PURCHASE_RECEIPT",
                    "RECEIPT",
                ]);
                if (ref && DISALLOWED_ON_STORE.has(ref)) {
                    throw new errors_2.AppError("Invalid refType for STORE", {
                        status: 400,
                        code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                        details: {
                            field: "refType",
                            reason: "not allowed when warehouse.kind=STORE",
                            refType: data.refType,
                        },
                    });
                }
            }
            // 1bis) garde-fou service : corrections doivent avoir une note (audit)
            if (data.refType === "CORRECTION" && !data.note?.trim()) {
                throw new errors_2.AppError("Note required for correction", {
                    status: 400,
                    code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                    details: { field: "note", reason: "required when refType=CORRECTION" },
                });
            }
            // upsert stock item (solde)
            const current = await tx.stockItem.findUnique({
                where: { warehouseId_productId: { warehouseId: data.warehouseId, productId: data.productId } },
            });
            const currentQty = current?.quantity ?? 0;
            const nextQty = currentQty + data.qtyDelta;
            if (nextQty < 0) {
                const requested = data.qtyDelta < 0 ? Math.abs(data.qtyDelta) : data.qtyDelta;
                throw (0, errors_1.insufficientStockError)({ available: currentQty, requested });
            }
            const stockItem = await tx.stockItem.upsert({
                where: { warehouseId_productId: { warehouseId: data.warehouseId, productId: data.productId } },
                update: { quantity: nextQty },
                create: {
                    warehouseId: data.warehouseId,
                    productId: data.productId,
                    quantity: nextQty,
                },
            });
            const move = await tx.stockMove.create({
                data: {
                    kind: data.kind,
                    warehouseId: data.warehouseId,
                    productId: data.productId,
                    qtyDelta: data.qtyDelta,
                    refType: data.refType ?? null,
                    refId: data.refId ?? null,
                    note: data.note ?? null,
                },
            });
            return { stockItem, move };
        });
    },
    /**
     * Retour client (métier) : crée un mouvement IN avec audit.
     * Attendu par stock.routes.ts: stockService.createReturn(data)
     */
    createReturn: async (data) => {
        const qty = Number(data?.qty);
        if (!Number.isInteger(qty) || qty <= 0) {
            throw new errors_2.AppError("Invalid qty", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "qty", reason: "must be an integer > 0" },
            });
        }
        const reason = typeof data?.reason === "string" ? data.reason.trim() : "";
        // refType métier (audit)
        return exports.stockService.createMove({
            kind: "IN",
            warehouseId: String(data.warehouseId),
            productId: String(data.productId),
            qtyDelta: qty,
            refType: "RETURN",
            refId: null,
            note: (data?.note ?? "").trim() || (reason ? `Retour client: ${reason}` : "Retour client"),
        });
    },
    /**
     * Casse / vol (métier) : crée un mouvement OUT avec audit.
     * Attendu par stock.routes.ts: stockService.createLoss(data)
     */
    createLoss: async (data) => {
        const qty = Number(data?.qty);
        if (!Number.isInteger(qty) || qty <= 0) {
            throw new errors_2.AppError("Invalid qty", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "qty", reason: "must be an integer > 0" },
            });
        }
        const lossType = typeof data?.type === "string" ? data.type.trim() : "";
        const note = typeof data?.note === "string" ? data.note.trim() : "";
        if (!note) {
            throw new errors_2.AppError("Note required for loss", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "note", reason: "required" },
            });
        }
        return exports.stockService.createMove({
            kind: "OUT",
            warehouseId: String(data.warehouseId),
            productId: String(data.productId),
            qtyDelta: -qty,
            refType: "LOSS",
            refId: null,
            note: lossType ? `${note} (type: ${lossType})` : note,
        });
    },
    /**
     * LEGACY / porte de secours: "set stock" via ADJUST.
     * Attendu par stock.routes.ts: stockService.setInventory({ warehouseId, productId, countedQty, note })
     * - calcule le delta = countedQty - currentQty
     * - refuse le no-op (delta=0) en renvoyant l'état courant
     */
    setInventory: async (data) => {
        const warehouseId = String(data?.warehouseId ?? "").trim();
        const productId = String(data?.productId ?? "").trim();
        const countedQty = Number(data?.countedQty);
        if (!warehouseId) {
            throw new errors_2.AppError("Invalid warehouseId", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "warehouseId", reason: "required" },
            });
        }
        if (!productId) {
            throw new errors_2.AppError("Invalid productId", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "productId", reason: "required" },
            });
        }
        if (!Number.isInteger(countedQty) || countedQty < 0) {
            throw new errors_2.AppError("Invalid countedQty", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "countedQty", reason: "must be an integer >= 0" },
            });
        }
        // note obligatoire côté route, on garde un garde-fou ici aussi
        const note = typeof data?.note === "string" ? data.note.trim() : "";
        if (!note) {
            throw new errors_2.AppError("Note required", {
                status: 400,
                code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                details: { field: "note", reason: "required" },
            });
        }
        // calc delta
        const currentQty = await exports.stockService.getQty(warehouseId, productId);
        const delta = countedQty - currentQty;
        // no-op: renvoyer l'état courant (sans créer de move)
        if (delta === 0) {
            const stockItem = await prisma_1.prisma.stockItem.findUnique({
                where: { warehouseId_productId: { warehouseId, productId } },
            });
            return {
                stockItem: stockItem ?? { warehouseId, productId, quantity: currentQty },
                move: null,
            };
        }
        return exports.stockService.createMove({
            kind: "ADJUST",
            warehouseId,
            productId,
            qtyDelta: delta,
            refType: "LEGACY_INVENTORY",
            refId: null,
            note,
        });
    },
    /**
     * Récupérer un transfert (header + lignes) pour la page détail.
     */
    getTransfer: async (id) => {
        const t = await prisma_1.prisma.stockTransfer.findUnique({
            where: { id },
            include: stockTransferWithLinesInclude,
        });
        if (!t) {
            throw new errors_2.AppError("Transfer not found", { status: 404, code: errors_2.ERROR_CODES.NOT_FOUND });
        }
        const delivery = await prisma_1.prisma.delivery.findUnique({
            where: { transferId: id },
            select: { id: true, number: true },
        });
        const base = mapTransfer(t);
        return {
            item: {
                ...base,
                deliveryId: delivery?.id ?? null,
                deliveryNumber: delivery?.number ?? null,
                delivery: delivery ? { id: delivery.id, number: delivery.number } : null,
            },
        };
    },
    /**
     * Créer un transfert DRAFT (document) :
     * - crée StockTransfer + StockTransferLine
     * - NE BOUGE PAS le stock
     */
    createTransferDraft: async (data) => {
        assertTransfer(data);
        const normalizedLines = normalizeTransferLines(data);
        const productIds = normalizedLines.map((l) => l.productId);
        return prisma_1.prisma.$transaction(async (tx) => {
            const [fromWh, toWh] = await Promise.all([
                tx.warehouse.findFirst({
                    where: { id: data.fromWarehouseId, deletedAt: null },
                    select: { id: true, kind: true, code: true, name: true },
                }),
                tx.warehouse.findFirst({
                    where: { id: data.toWarehouseId, deletedAt: null },
                    select: { id: true, kind: true, code: true, name: true },
                }),
            ]);
            if (!fromWh) {
                throw new errors_2.AppError("Warehouse not found", {
                    status: 404,
                    code: errors_2.ERROR_CODES.NOT_FOUND,
                    details: { field: "fromWarehouseId" },
                });
            }
            if (!toWh) {
                throw new errors_2.AppError("Warehouse not found", {
                    status: 404,
                    code: errors_2.ERROR_CODES.NOT_FOUND,
                    details: { field: "toWarehouseId" },
                });
            }
            const allowedKinds = new Set(["DEPOT", "STORE"]);
            if (!allowedKinds.has(fromWh.kind) || !allowedKinds.has(toWh.kind)) {
                throw new errors_2.AppError("Invalid warehouse kind", {
                    status: 400,
                    code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                    details: { fromKind: fromWh.kind, toKind: toWh.kind },
                });
            }
            // Vérifier produits en 1 requête
            const products = await tx.product.findMany({
                where: { id: { in: productIds }, deletedAt: null },
                select: { id: true },
            });
            const productsSet = new Set(products.map((p) => p.id));
            for (const pid of productIds) {
                if (!productsSet.has(pid)) {
                    throw new errors_2.AppError("Product not found", {
                        status: 404,
                        code: errors_2.ERROR_CODES.NOT_FOUND,
                        details: { productId: pid },
                    });
                }
            }
            const transfer = await tx.stockTransfer.create({
                data: {
                    fromWarehouseId: data.fromWarehouseId,
                    toWarehouseId: data.toWarehouseId,
                    note: data.note ?? null,
                    status: "DRAFT",
                    // A+ ERP: regrouper 2 transferts (DEPOT->TRANSIT et TRANSIT->STORE)
                    journeyId: data.journeyId ?? null,
                    purpose: data.purpose ?? undefined,
                },
            });
            await tx.stockTransferLine.createMany({
                data: normalizedLines.map((l) => ({
                    transferId: transfer.id,
                    productId: l.productId,
                    qty: l.qty,
                    qtyReceived: 0,
                    note: l.note ?? null,
                })),
            });
            const created = await tx.stockTransfer.findUnique({
                where: { id: transfer.id },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    lines: { orderBy: { createdAt: "asc" }, include: { product: true } },
                },
            });
            return {
                item: {
                    id: created.id,
                    status: created.status,
                    note: created.note ?? null,
                    createdAt: created.createdAt,
                    journeyId: created.journeyId ?? null,
                    purpose: created.purpose ?? null,
                    fromWarehouse: created.fromWarehouse,
                    toWarehouse: created.toWarehouse,
                    lines: (created.lines ?? []).map((l) => ({
                        id: l.id,
                        productId: l.productId,
                        product: l.product,
                        qty: l.qty,
                        qtyReceived: l.qtyReceived ?? 0,
                        note: l.note ?? null,
                    })),
                },
            };
        });
    },
    /**
     * A+ ERP (trajet): crée 2 transferts DRAFT liés par journeyId
     * - T1: from DEPOT -> TRANSIT
     * - T2: from TRANSIT -> STORE
     * - même journeyId sur les deux
     * - ne bouge pas le stock (stock bouge à ship/receive)
     */
    createTransferJourney: async (data) => {
        assertTransfer(data);
        // Trouver l'entrepôt TRANSIT (seed garantit code=TRANSIT)
        const transit = await prisma_1.prisma.warehouse.findFirst({
            where: { code: "TRANSIT", deletedAt: null },
            select: { id: true, code: true },
        });
        if (!transit) {
            throw new errors_2.AppError("TRANSIT warehouse not found", {
                status: 500,
                code: errors_2.ERROR_CODES.INTERNAL_ERROR,
                details: { code: "TRANSIT" },
            });
        }
        const journeyId = typeof data.journeyId === "string" && data.journeyId.trim()
            ? String(data.journeyId).trim()
            : undefined;
        // JourneyId stable : si non fourni, on génère un cuid via Prisma (petit hack propre)
        const effectiveJourneyId = journeyId ?? (await prisma_1.prisma.stockTransfer.create({
            data: {
                fromWarehouseId: data.fromWarehouseId,
                toWarehouseId: transit.id,
                status: "DRAFT",
                note: "__JOURNEY_PLACEHOLDER__",
            },
            select: { id: true },
        })).id;
        // Si on a créé un placeholder, on le supprime et on recrée les vrais transferts dans une transaction
        if (!journeyId) {
            await prisma_1.prisma.stockTransfer.delete({ where: { id: effectiveJourneyId } });
        }
        const base = {
            note: data.note ?? null,
            purpose: data.purpose ?? "INTERNAL_DELIVERY",
            journeyId: effectiveJourneyId,
            lines: data.lines,
            productId: data.productId,
            qty: data.qty,
        };
        // T1: DEPOT -> TRANSIT
        const t1 = await exports.stockService.createTransferDraft({
            ...base,
            fromWarehouseId: data.fromWarehouseId,
            toWarehouseId: transit.id,
        });
        // T2: TRANSIT -> STORE
        const t2 = await exports.stockService.createTransferDraft({
            ...base,
            fromWarehouseId: transit.id,
            toWarehouseId: data.toWarehouseId,
        });
        return { journeyId: effectiveJourneyId, t1: t1.item, t2: t2.item };
    },
    /**
     * Expédier un transfert :
     * - vérifie status=DRAFT
     * - vérifie stocks source pour toutes les lignes
     * - décrémente la source + crée moves OUT liés au transferId
     * - status=SHIPPED + shippedAt
     */
    shipTransfer: async (id, data) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findUnique({
                where: { id },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    lines: { orderBy: { createdAt: "asc" } },
                },
            });
            if (!transfer) {
                throw new errors_2.AppError("Transfer not found", { status: 404, code: errors_2.ERROR_CODES.NOT_FOUND });
            }
            if (String(transfer.status) !== "DRAFT") {
                throw new errors_2.AppError("Transfer is not in DRAFT", {
                    status: 409,
                    code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                    details: { status: transfer.status },
                });
            }
            const fromWarehouseId = transfer.fromWarehouseId;
            const productIds = (transfer.lines ?? []).map((l) => l.productId);
            const sourceItems = await tx.stockItem.findMany({
                where: { warehouseId: fromWarehouseId, productId: { in: productIds } },
                select: { productId: true, quantity: true },
            });
            const sourceMap = new Map(sourceItems.map((s) => [s.productId, s.quantity]));
            for (const l of transfer.lines ?? []) {
                const available = sourceMap.get(l.productId) ?? 0;
                if (available - l.qty < 0) {
                    throw (0, errors_1.insufficientStockError)({ available, requested: l.qty });
                }
            }
            // Apply source decrements
            for (const l of transfer.lines ?? []) {
                const current = sourceMap.get(l.productId) ?? 0;
                const next = current - l.qty;
                await tx.stockItem.upsert({
                    where: { warehouseId_productId: { warehouseId: fromWarehouseId, productId: l.productId } },
                    update: { quantity: next },
                    create: { warehouseId: fromWarehouseId, productId: l.productId, quantity: next },
                });
            }
            // Create OUT moves
            await tx.stockMove.createMany({
                data: (transfer.lines ?? []).map((l) => ({
                    kind: "OUT",
                    warehouseId: transfer.fromWarehouseId,
                    productId: l.productId,
                    qtyDelta: -l.qty,
                    transferId: transfer.id,
                    refType: null,
                    refId: null,
                    note: data?.note ?? transfer.note ?? l.note ?? null,
                })),
            });
            // A+ ERP (TRANSIT): Ship T1 = OUT dépôt + IN transit (stock "en route")
            const isTransitT1 = String(transfer?.toWarehouse?.code ?? "").toUpperCase() === "TRANSIT";
            if (isTransitT1) {
                const transitWarehouseId = transfer.toWarehouseId;
                // Incrémenter le stock TRANSIT
                const transitRows = await tx.stockItem.findMany({
                    where: { warehouseId: transitWarehouseId, productId: { in: productIds } },
                    select: { productId: true, quantity: true },
                });
                const transitMap = new Map(transitRows.map((r) => [r.productId, r.quantity]));
                for (const l of transfer.lines ?? []) {
                    const current = transitMap.get(l.productId) ?? 0;
                    const next = current + l.qty;
                    transitMap.set(l.productId, next);
                    await tx.stockItem.upsert({
                        where: { warehouseId_productId: { warehouseId: transitWarehouseId, productId: l.productId } },
                        update: { quantity: next },
                        create: { warehouseId: transitWarehouseId, productId: l.productId, quantity: next },
                    });
                }
                // Moves IN dans TRANSIT (liés au transferId)
                await tx.stockMove.createMany({
                    data: (transfer.lines ?? []).map((l) => ({
                        kind: "IN",
                        warehouseId: transitWarehouseId,
                        productId: l.productId,
                        qtyDelta: l.qty,
                        transferId: transfer.id,
                        refType: null,
                        refId: null,
                        note: data?.note ?? transfer.note ?? l.note ?? null,
                    })),
                });
            }
            const updated = await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: "SHIPPED",
                    shippedAt: new Date(),
                    note: data?.note ? String(data.note) : undefined,
                },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    lines: { orderBy: { createdAt: "asc" }, include: { product: true } },
                },
            });
            // If this transfer is linked to a Delivery (BL), auto-log an event
            await addDeliveryEventForTransferTx(tx, transfer.id, {
                type: "TRANSFER_SHIPPED",
                message: "Expédié",
                meta: {
                    transferId: transfer.id,
                    shippedAt: updated.shippedAt ?? null,
                    fromWarehouseId: transfer.fromWarehouseId,
                    toWarehouseId: transfer.toWarehouseId,
                },
            });
            return {
                item: {
                    id: updated.id,
                    status: updated.status,
                    note: updated.note ?? null,
                    shippedAt: updated.shippedAt ?? null,
                    receivedAt: updated.receivedAt ?? null,
                    createdAt: updated.createdAt,
                    fromWarehouse: updated.fromWarehouse,
                    toWarehouse: updated.toWarehouse,
                    lines: (updated.lines ?? []).map((l) => ({
                        id: l.id,
                        productId: l.productId,
                        product: l.product,
                        qty: l.qty,
                        qtyReceived: l.qtyReceived ?? 0,
                        note: l.note ?? null,
                    })),
                },
            };
        });
    },
    /**
     * Réceptionner un transfert :
     * - vérifie status=SHIPPED (ou PARTIALLY_RECEIVED)
     * - incrémente la destination + crée moves IN liés au transferId
     * - met à jour qtyReceived par ligne
     * - status: RECEIVED si tout reçu, sinon PARTIALLY_RECEIVED
     */
    receiveTransfer: async (id, data) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findUnique({
                where: { id },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    lines: { orderBy: { createdAt: "asc" } },
                },
            });
            if (!transfer) {
                throw new errors_2.AppError("Transfer not found", { status: 404, code: errors_2.ERROR_CODES.NOT_FOUND });
            }
            const status = String(transfer.status);
            if (status !== "SHIPPED" && status !== "PARTIALLY_RECEIVED") {
                throw new errors_2.AppError("Transfer is not in SHIPPED", {
                    status: 409,
                    code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                    details: { status: transfer.status },
                });
            }
            const byProduct = new Map();
            for (const l of transfer.lines ?? [])
                byProduct.set(String(l.productId), l);
            const inputLines = Array.isArray(data?.lines) ? data.lines : [];
            if (!inputLines.length) {
                throw new errors_2.AppError("Invalid lines", {
                    status: 400,
                    code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                    details: { field: "lines", reason: "required" },
                });
            }
            // Validate requested receives
            for (let i = 0; i < inputLines.length; i++) {
                const l = inputLines[i];
                const pid = String(l?.productId ?? "").trim();
                const qtyReceived = Number(l?.qtyReceived);
                if (!pid) {
                    throw new errors_2.AppError("Invalid productId", {
                        status: 400,
                        code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                        details: { field: `lines[${i}].productId`, reason: "required" },
                    });
                }
                if (!Number.isInteger(qtyReceived) || qtyReceived < 0) {
                    throw new errors_2.AppError("Invalid qtyReceived", {
                        status: 400,
                        code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                        details: { field: `lines[${i}].qtyReceived`, reason: "must be an integer >= 0" },
                    });
                }
                const base = byProduct.get(pid);
                if (!base) {
                    throw new errors_2.AppError("Product not part of transfer", {
                        status: 400,
                        code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                        details: { productId: pid },
                    });
                }
                const already = Number(base.qtyReceived ?? 0) || 0;
                const maxToReceive = (Number(base.qty ?? 0) || 0) - already;
                if (qtyReceived > maxToReceive) {
                    throw new errors_2.AppError("qtyReceived exceeds remaining", {
                        status: 400,
                        code: errors_2.ERROR_CODES.VALIDATION_ERROR,
                        details: { productId: pid, remaining: maxToReceive, requested: qtyReceived },
                    });
                }
            }
            // A+ ERP (TRANSIT): Receive T2 = OUT transit + IN magasin (sur les quantités réellement reçues)
            const isTransitT2 = String(transfer?.fromWarehouse?.code ?? "").toUpperCase() === "TRANSIT";
            if (isTransitT2) {
                const transitWarehouseId = transfer.fromWarehouseId;
                const transitProductIds = inputLines.map((l) => String(l.productId).trim());
                const transitItems = await tx.stockItem.findMany({
                    where: { warehouseId: transitWarehouseId, productId: { in: transitProductIds } },
                    select: { productId: true, quantity: true },
                });
                const transitMap = new Map(transitItems.map((s) => [s.productId, s.quantity]));
                // Vérifier stock transit suffisant
                for (const l of inputLines) {
                    const pid = String(l.productId).trim();
                    const qtyReceived = Number(l.qtyReceived);
                    if (!qtyReceived)
                        continue;
                    const available = transitMap.get(pid) ?? 0;
                    if (available - qtyReceived < 0) {
                        throw (0, errors_1.insufficientStockError)({ available, requested: qtyReceived });
                    }
                }
                // Décrémenter stock transit
                for (const l of inputLines) {
                    const pid = String(l.productId).trim();
                    const qtyReceived = Number(l.qtyReceived);
                    if (!qtyReceived)
                        continue;
                    const current = transitMap.get(pid) ?? 0;
                    const next = current - qtyReceived;
                    transitMap.set(pid, next);
                    await tx.stockItem.upsert({
                        where: { warehouseId_productId: { warehouseId: transitWarehouseId, productId: pid } },
                        update: { quantity: next },
                        create: { warehouseId: transitWarehouseId, productId: pid, quantity: next },
                    });
                }
                // Moves OUT depuis TRANSIT (liés au transferId)
                await tx.stockMove.createMany({
                    data: inputLines
                        .filter((l) => Number(l.qtyReceived) > 0)
                        .map((l) => ({
                        kind: "OUT",
                        warehouseId: transitWarehouseId,
                        productId: String(l.productId).trim(),
                        qtyDelta: -Number(l.qtyReceived),
                        transferId: transfer.id,
                        refType: null,
                        refId: null,
                        note: data?.note ?? transfer.note ?? null,
                    })),
                });
            }
            // Destination current quantities in 1 batch
            const destWarehouseId = transfer.toWarehouseId;
            const productIds = inputLines.map((l) => String(l.productId).trim());
            const destItems = await tx.stockItem.findMany({
                where: { warehouseId: destWarehouseId, productId: { in: productIds } },
                select: { productId: true, quantity: true },
            });
            const destMap = new Map(destItems.map((s) => [s.productId, s.quantity]));
            // Apply destination increments + moves + line updates
            for (const l of inputLines) {
                const pid = String(l.productId).trim();
                const qtyReceived = Number(l.qtyReceived);
                if (!qtyReceived)
                    continue; // allow 0 lines
                const current = destMap.get(pid) ?? 0;
                const next = current + qtyReceived;
                destMap.set(pid, next);
                await tx.stockItem.upsert({
                    where: { warehouseId_productId: { warehouseId: destWarehouseId, productId: pid } },
                    update: { quantity: next },
                    create: { warehouseId: destWarehouseId, productId: pid, quantity: next },
                });
                await tx.stockMove.create({
                    data: {
                        kind: "IN",
                        warehouseId: destWarehouseId,
                        productId: pid,
                        qtyDelta: qtyReceived,
                        transferId: transfer.id,
                        refType: null,
                        refId: null,
                        note: data?.note ?? transfer.note ?? null,
                    },
                });
                // update qtyReceived on the line
                const base = byProduct.get(pid);
                const already = Number(base.qtyReceived ?? 0) || 0;
                await tx.stockTransferLine.update({
                    where: { id: base.id },
                    data: { qtyReceived: already + qtyReceived },
                });
            }
            // Re-fetch with lines to compute final status
            const updated = await tx.stockTransfer.findUnique({
                where: { id: transfer.id },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    lines: { orderBy: { createdAt: "asc" }, include: { product: true } },
                },
            });
            const fully = isFullyReceived(updated.lines ?? []);
            const nextStatus = fully ? "RECEIVED" : "PARTIALLY_RECEIVED";
            const final = await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: nextStatus,
                    receivedAt: fully ? new Date() : undefined,
                    note: data?.note ? String(data.note) : undefined,
                },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    lines: { orderBy: { createdAt: "asc" }, include: { product: true } },
                },
            });
            // If this transfer is linked to a Delivery (BL), auto-log an event
            const totalExpected = (final.lines ?? []).reduce((s, l) => s + (Number(l.qty ?? 0) || 0), 0);
            const totalReceived = (final.lines ?? []).reduce((s, l) => s + (Number(l.qtyReceived ?? 0) || 0), 0);
            await addDeliveryEventForTransferTx(tx, transfer.id, {
                type: nextStatus === "RECEIVED" ? "TRANSFER_RECEIVED" : "TRANSFER_PARTIALLY_RECEIVED",
                message: nextStatus === "RECEIVED" ? "Reçu" : "Reçu partiel",
                meta: {
                    transferId: transfer.id,
                    status: nextStatus,
                    totals: {
                        expected: totalExpected,
                        received: totalReceived,
                        missing: Math.max(0, totalExpected - totalReceived),
                    },
                },
            });
            return {
                item: {
                    id: final.id,
                    status: final.status,
                    note: final.note ?? null,
                    shippedAt: final.shippedAt ?? null,
                    receivedAt: final.receivedAt ?? null,
                    createdAt: final.createdAt,
                    fromWarehouse: final.fromWarehouse,
                    toWarehouse: final.toWarehouse,
                    lines: (final.lines ?? []).map((l) => ({
                        id: l.id,
                        productId: l.productId,
                        product: l.product,
                        qty: l.qty,
                        qtyReceived: l.qtyReceived ?? 0,
                        note: l.note ?? null,
                    })),
                },
            };
        });
    },
    /**
     * Legacy wrapper : garder l'ancien comportement "POSTED" (stock bouge tout de suite)
     * en utilisant le workflow : DRAFT -> SHIP -> RECEIVE (qtyReceived=qty).
     */
    createTransfer: async (data) => {
        const draft = await exports.stockService.createTransferDraft(data);
        const shipped = await exports.stockService.shipTransfer(draft.item.id, { note: data.note ?? null });
        const lines = (shipped.item.lines ?? []).map((l) => ({
            productId: l.productId,
            qtyReceived: l.qty,
        }));
        const received = await exports.stockService.receiveTransfer(shipped.item.id, { lines, note: data.note ?? null });
        // For backward compat with callers expecting POSTED, we keep status as RECEIVED.
        return received;
    },
    /**
     * Historique transferts (ultra pro) : lecture directe de StockTransfer.
     */
    listTransfers: async (limit = 100) => {
        const transfers = await prisma_1.prisma.stockTransfer.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            include: stockTransferWithLinesInclude,
        });
        const ids = transfers.map((t) => t.id);
        const deliveries = ids.length
            ? await prisma_1.prisma.delivery.findMany({
                where: { transferId: { in: ids } },
                select: { id: true, number: true, transferId: true },
            })
            : [];
        const deliveryByTransferId = new Map(deliveries.map((d) => [d.transferId, d]));
        return {
            items: transfers.map((t) => {
                const base = mapTransfer(t);
                const d = deliveryByTransferId.get(t.id);
                return {
                    ...base,
                    deliveryId: d?.id ?? null,
                    deliveryNumber: d?.number ?? null,
                    delivery: d ? { id: d.id, number: d.number } : null,
                };
            }),
        };
    },
    /**
     * V1 (optionnel): derniers mouvements d'un entrepôt
     */
    lastMoves: async (warehouseId, limit = 50) => {
        return prisma_1.prisma.stockMove.findMany({
            where: { warehouseId },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: { product: true },
        });
    },
};
