"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersService = void 0;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../lib/errors");
function nowStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `OR-${y}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
}
function computeTotals(lines, shippingFee) {
    const totalHT = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    const totalTTC = totalHT + (shippingFee ?? 0);
    return { totalHT, totalTTC };
}
async function getEffectiveUnitPrices(args) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({
        where: { id: args.warehouseId },
        select: { id: true, priceListId: true },
    });
    if (!warehouse) {
        throw new errors_1.AppError("Warehouse not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
    }
    const hasMissing = args.lines.some((l) => l.unitPrice == null);
    if (!hasMissing) {
        return args.lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice }));
    }
    // pricing: pricelist -> fallback product.price
    const productIds = Array.from(new Set(args.lines.map((l) => l.productId)));
    const products = await prisma_1.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, price: true, name: true },
    });
    const productPriceMap = new Map(products.map((p) => [p.id, p.price ?? 0]));
    let priceMap = new Map();
    if (warehouse.priceListId) {
        const items = await prisma_1.prisma.priceListItem.findMany({
            where: { priceListId: warehouse.priceListId, productId: { in: productIds } },
            select: { productId: true, unitPrice: true },
        });
        priceMap = new Map(items.map((i) => [i.productId, i.unitPrice]));
    }
    return args.lines.map((l) => {
        if (l.unitPrice != null)
            return { productId: l.productId, qty: l.qty, unitPrice: l.unitPrice };
        const fromList = priceMap.get(l.productId);
        if (typeof fromList === "number")
            return { productId: l.productId, qty: l.qty, unitPrice: fromList };
        // fallback product.price
        const fallback = productPriceMap.get(l.productId);
        if (typeof fallback === "number")
            return { productId: l.productId, qty: l.qty, unitPrice: fallback };
        // should never happen, but safety
        throw new errors_1.AppError("Pricing not found", {
            status: 409,
            code: errors_1.ERROR_CODES.CONFLICT,
            details: { productId: l.productId },
        });
    });
}
exports.ordersService = {
    list: async (q) => {
        const where = {};
        if (q.status && q.status !== "all")
            where.status = q.status;
        if (q.warehouseId)
            where.warehouseId = q.warehouseId;
        if (q.clientId)
            where.clientId = q.clientId;
        if (q.q) {
            // simple search: order.number OR client.nameSearch contains
            const qq = q.q.trim();
            where.OR = [
                { number: { contains: qq } },
                { client: { name: { contains: qq } } },
            ];
        }
        const items = await prisma_1.prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: q.limit,
            include: {
                client: { select: { id: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true } },
                invoice: { select: { id: true, number: true, status: true } },
                lines: { select: { qty: true, qtyDelivered: true } },
                deliveries: { select: { id: true, status: true } },
            },
        });
        const deliveryDoneStatuses = new Set(["DELIVERED", "CANCELLED"]);
        const enriched = items.map((o) => {
            const deliveriesCount = o.deliveries?.length ?? 0;
            const remainingLinesCount = (o.lines ?? []).reduce((acc, l) => {
                const ordered = Number(l.qty ?? 0);
                const delivered = Number(l.qtyDelivered ?? 0);
                return acc + (delivered < ordered ? 1 : 0);
            }, 0);
            const hasRemaining = remainingLinesCount > 0;
            const anyOutForDelivery = (o.deliveries ?? []).some((d) => d.status === "OUT_FOR_DELIVERY");
            const anyDelivered = (o.deliveries ?? []).some((d) => d.status === "DELIVERED");
            const anyPartial = (o.deliveries ?? []).some((d) => d.status === "PARTIALLY_DELIVERED");
            const allDeliveriesDone = deliveriesCount > 0 && (o.deliveries ?? []).every((d) => deliveryDoneStatuses.has(d.status));
            // Logistics overview label (stable, derived)
            let logisticsStatus = "TO_PREPARE";
            if (o.status === "CANCELLED")
                logisticsStatus = "CANCELLED";
            else if (deliveriesCount === 0)
                logisticsStatus = "NO_BL";
            else if (!hasRemaining && allDeliveriesDone)
                logisticsStatus = "DONE";
            else if (anyOutForDelivery)
                logisticsStatus = "IN_PROGRESS";
            else if (hasRemaining && (anyDelivered || anyPartial))
                logisticsStatus = "PARTIAL";
            else
                logisticsStatus = "TO_PREPARE";
            // Next action hint for the list view
            let nextAction = null;
            if (o.status === "DRAFT")
                nextAction = "CONFIRM";
            else if (o.status === "CONFIRMED")
                nextAction = "PREPARE";
            else if (o.status === "PREPARED" && deliveriesCount === 0)
                nextAction = "CREATE_BL";
            else if (o.status === "PREPARED" && deliveriesCount > 0)
                nextAction = "DISPATCH";
            else if (o.status === "SHIPPED" && hasRemaining)
                nextAction = "DELIVER_REMAINDER";
            else if (o.status === "SHIPPED" && !hasRemaining && allDeliveriesDone)
                nextAction = "CLOSE_ORDER";
            return {
                ...o,
                deliveriesCount,
                remainingLinesCount,
                hasRemaining,
                logisticsStatus,
                nextAction,
            };
        });
        return { items: enriched };
    },
    get: async (id) => {
        const item = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true } },
                invoice: { select: { id: true, number: true, status: true } },
                lines: {
                    orderBy: { createdAt: "asc" },
                    include: { product: { select: { id: true, sku: true, name: true, unit: true, taxCode: true, taxRate: true } } },
                },
                deliveries: { select: { id: true, number: true, status: true, createdAt: true } },
            },
        });
        if (!item) {
            throw new errors_1.AppError("Order not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
        }
        return { item };
    },
    quote: async (body) => {
        const lines = body.lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice ?? undefined,
        }));
        const priced = await getEffectiveUnitPrices({
            warehouseId: body.warehouseId,
            lines,
        });
        const totalHT = priced.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
        const totalTTC = totalHT; // dépôt: shippingFee géré au moment create/update (si besoin)
        return {
            lines: priced,
            totalHT,
            totalTTC,
        };
    },
    create: async (body) => {
        const fulfillment = body.fulfillment ?? "PICKUP";
        const shippingFee = fulfillment === "PICKUP" ? 0 : Math.max(0, Math.trunc(body.shippingFee ?? 0));
        const priced = await getEffectiveUnitPrices({
            warehouseId: body.warehouseId,
            lines: body.lines.map((l) => ({
                productId: l.productId,
                qty: Math.max(1, Math.trunc(l.qty)),
                unitPrice: l.unitPrice ?? undefined,
            })),
        });
        const { totalHT, totalTTC } = computeTotals(priced.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })), shippingFee);
        const item = await prisma_1.prisma.order.create({
            data: {
                number: nowStamp(),
                status: "DRAFT",
                warehouseId: body.warehouseId,
                clientId: body.clientId ?? null,
                fulfillment,
                shippingFee,
                note: body.note ?? null,
                totalHT,
                totalTTC,
                lines: {
                    create: priced.map((l) => ({
                        productId: l.productId,
                        qty: l.qty,
                        unitPrice: l.unitPrice,
                    })),
                },
            },
            include: {
                client: { select: { id: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true } },
                lines: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
            },
        });
        return { item };
    },
    setStatus: async (id, next) => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id },
                select: { id: true, status: true },
            });
            if (!order) {
                throw new errors_1.AppError("Order not found", { status: 404, code: errors_1.ERROR_CODES.NOT_FOUND });
            }
            const current = order.status;
            // transitions simples métier dépôt
            const allowed = {
                DRAFT: ["CONFIRMED", "CANCELLED"],
                CONFIRMED: ["PREPARED", "CANCELLED"],
                PREPARED: ["SHIPPED", "CANCELLED"],
                SHIPPED: ["DELIVERED"],
                DELIVERED: [],
                CANCELLED: [],
            };
            if (!allowed[current]?.includes(next)) {
                throw new errors_1.AppError("Invalid status transition", {
                    status: 409,
                    code: errors_1.ERROR_CODES.CONFLICT,
                    details: { current, next },
                });
            }
            const data = { status: next };
            const now = new Date();
            if (next === "CONFIRMED")
                data.confirmedAt = now;
            if (next === "PREPARED")
                data.preparedAt = now;
            if (next === "SHIPPED")
                data.shippedAt = now;
            if (next === "DELIVERED")
                data.deliveredAt = now;
            const updated = await tx.order.update({
                where: { id },
                data,
                include: {
                    client: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, code: true, name: true } },
                    invoice: { select: { id: true, number: true, status: true } },
                    lines: {
                        orderBy: { createdAt: "asc" },
                        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
                    },
                    deliveries: { select: { id: true, number: true, status: true, createdAt: true } },
                },
            });
            return { item: updated };
        });
    },
};
