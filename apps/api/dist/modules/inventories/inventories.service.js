"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoriesService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function makeInventoryNumber() {
    // Simple + robuste (unique) sans compteur: INVSTK-YYYYMMDD-xxxxx
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `INVSTK-${y}${m}${day}-${rand}`;
}
const inventoryListInclude = {
    warehouse: true,
    category: true,
    _count: { select: { lines: true } },
};
const inventoryGetInclude = {
    warehouse: true,
    category: true,
    lines: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: { product: { include: { category: true } } },
    },
};
const inventoryPostInclude = {
    warehouse: { select: { id: true, kind: true } },
    lines: { include: { product: { select: { id: true } } } },
};
exports.inventoriesService = {
    list: async (q) => {
        const where = {};
        if (q.warehouseId)
            where.warehouseId = q.warehouseId;
        if (q.status)
            where.status = q.status;
        const items = await prisma_1.prisma.stockInventory.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: q.limit ?? 50,
            include: inventoryListInclude,
        });
        return items;
    },
    get: async (id) => {
        const item = await prisma_1.prisma.stockInventory.findUnique({
            where: { id },
            include: inventoryGetInclude,
        });
        return item;
    },
    createDraft: async (data) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const wh = await tx.warehouse.findFirst({
                where: { id: data.warehouseId, deletedAt: null },
                select: { id: true, kind: true, name: true, code: true },
            });
            if (!wh) {
                throw new errors_1.AppError("Warehouse not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            }
            if (data.mode === "CATEGORY" && !data.categoryId) {
                throw new errors_1.AppError("categoryId required for CATEGORY mode", {
                    status: 400,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { field: "categoryId" },
                });
            }
            if (data.categoryId) {
                const cat = await tx.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } });
                if (!cat) {
                    throw new errors_1.AppError("Category not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND, details: { categoryId: data.categoryId } });
                }
            }
            const inv = await tx.stockInventory.create({
                data: {
                    number: makeInventoryNumber(),
                    status: "DRAFT",
                    mode: (data.mode ?? "FULL"),
                    warehouseId: data.warehouseId,
                    categoryId: data.categoryId ?? null,
                    note: data.note ?? null,
                },
            });
            return inv;
        });
    },
    generateLines: async (inventoryId, opts) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const inv = await tx.stockInventory.findUnique({
                where: { id: inventoryId },
                select: { id: true, status: true, mode: true, warehouseId: true, categoryId: true },
            });
            if (!inv)
                throw new errors_1.AppError("Inventory not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            if (inv.status !== "DRAFT") {
                throw new errors_1.AppError("Inventory not editable", { status: 400, code: errors_1.ERROR_CODES.VALIDATION_ERROR, details: { status: inv.status } });
            }
            const existing = await tx.stockInventoryLine.count({ where: { inventoryId: inv.id } });
            if (existing > 0) {
                throw new errors_1.AppError("Lines already generated", { status: 409, code: errors_1.ERROR_CODES.CONFLICT });
            }
            const mode = (opts?.mode ?? inv.mode);
            const categoryId = opts?.categoryId ?? inv.categoryId ?? null;
            if (mode === "CATEGORY" && !categoryId) {
                throw new errors_1.AppError("categoryId required for CATEGORY mode", {
                    status: 400,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { field: "categoryId" },
                });
            }
            // 1) produits ciblés
            const products = await tx.product.findMany({
                where: {
                    isActive: true,
                    deletedAt: null,
                    ...(mode === "CATEGORY" ? { categoryId } : {}),
                },
                select: { id: true },
                orderBy: { name: "asc" },
            });
            const productIds = products.map((p) => p.id);
            // 2) stock actuel (batch)
            const items = await tx.stockItem.findMany({
                where: { warehouseId: inv.warehouseId, productId: { in: productIds } },
                select: { productId: true, quantity: true },
            });
            const qtyMap = new Map(items.map((x) => [x.productId, x.quantity]));
            // 3) createMany lines
            await tx.stockInventoryLine.createMany({
                data: productIds.map((pid) => ({
                    inventoryId: inv.id,
                    productId: pid,
                    expectedQty: qtyMap.get(pid) ?? 0,
                    countedQty: null,
                    delta: 0,
                    status: "PENDING",
                    note: null,
                })),
            });
            // 4) sync header (mode/category)
            await tx.stockInventory.update({
                where: { id: inv.id },
                data: {
                    mode: mode,
                    categoryId: mode === "CATEGORY" ? categoryId : null,
                },
            });
            return { ok: true, count: productIds.length };
        });
    },
    updateLine: async (inventoryId, lineId, data) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const inv = await tx.stockInventory.findUnique({
                where: { id: inventoryId },
                select: { id: true, status: true },
            });
            if (!inv)
                throw new errors_1.AppError("Inventory not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            if (inv.status !== "DRAFT") {
                throw new errors_1.AppError("Inventory not editable", { status: 400, code: errors_1.ERROR_CODES.VALIDATION_ERROR });
            }
            const line = await tx.stockInventoryLine.findFirst({
                where: { id: lineId, inventoryId },
                select: { id: true, expectedQty: true, countedQty: true, status: true },
            });
            if (!line)
                throw new errors_1.AppError("Inventory line not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            const countedQty = data.countedQty === undefined ? undefined : data.countedQty;
            const nextCounted = countedQty === undefined ? line.countedQty : countedQty;
            const nextStatus = data.status ??
                (nextCounted !== null && nextCounted !== undefined ? "COUNTED" : "PENDING");
            const delta = nextCounted === null || nextCounted === undefined ? 0 : nextCounted - (line.expectedQty ?? 0);
            const updated = await tx.stockInventoryLine.update({
                where: { id: lineId },
                data: {
                    countedQty: countedQty === undefined ? undefined : nextCounted,
                    status: nextStatus,
                    delta,
                    note: data.note === undefined ? undefined : data.note ?? null,
                },
            });
            return updated;
        });
    },
    post: async (inventoryId, data) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const inv = (await tx.stockInventory.findUnique({
                where: { id: inventoryId },
                include: inventoryPostInclude,
            }));
            if (!inv)
                throw new errors_1.AppError("Inventory not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            if (inv.status !== "DRAFT") {
                throw new errors_1.AppError("Inventory already posted", { status: 400, code: errors_1.ERROR_CODES.VALIDATION_ERROR, details: { status: inv.status } });
            }
            // garde-fou: au moins une ligne
            if (!inv.lines?.length) {
                throw new errors_1.AppError("No lines to post", { status: 400, code: errors_1.ERROR_CODES.VALIDATION_ERROR });
            }
            // lignes comptées = celles qui ont countedQty non null et status COUNTED
            const counted = inv.lines.filter((l) => l.countedQty !== null && l.status !== "SKIPPED");
            // Si rien compté, c’est bizarre => refuse (sinon faille)
            if (counted.length === 0) {
                throw new errors_1.AppError("Nothing counted", {
                    status: 400,
                    code: errors_1.ERROR_CODES.VALIDATION_ERROR,
                    details: { reason: "no counted lines" },
                });
            }
            // Pour chaque ligne comptée: mettre stock = countedQty (via ADJUST delta)
            // On fait un batch du stock actuel pour calculer delta réel depuis StockItem (plus sûr).
            const productIds = counted.map((l) => l.productId);
            const stockItems = await tx.stockItem.findMany({
                where: { warehouseId: inv.warehouseId, productId: { in: productIds } },
                select: { productId: true, quantity: true },
            });
            const currentMap = new Map(stockItems.map((s) => [s.productId, s.quantity]));
            const movesToCreate = [];
            for (const l of counted) {
                const currentQty = currentMap.get(l.productId) ?? 0;
                const targetQty = Number(l.countedQty);
                const qtyDelta = targetQty - currentQty;
                if (qtyDelta === 0)
                    continue;
                movesToCreate.push({
                    kind: "ADJUST",
                    warehouseId: inv.warehouseId,
                    productId: l.productId,
                    qtyDelta,
                    refType: "INVENTORY",
                    refId: inv.id,
                    inventoryId: inv.id,
                    note: data.note,
                    transferId: null,
                });
            }
            // apply StockItem updates (upsert)
            for (const l of counted) {
                const targetQty = Number(l.countedQty);
                await tx.stockItem.upsert({
                    where: { warehouseId_productId: { warehouseId: inv.warehouseId, productId: l.productId } },
                    update: { quantity: targetQty },
                    create: { warehouseId: inv.warehouseId, productId: l.productId, quantity: targetQty },
                });
            }
            // create moves
            if (movesToCreate.length) {
                await tx.stockMove.createMany({ data: movesToCreate });
            }
            // lock inventory
            const now = new Date();
            const posted = await tx.stockInventory.update({
                where: { id: inv.id },
                data: {
                    status: "POSTED",
                    postedAt: now,
                    postedBy: (data.postedBy ?? null),
                    note: data.note,
                },
            });
            return posted;
        });
    },
};
