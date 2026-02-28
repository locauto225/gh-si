"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
// apps/api/src/modules/dashboard/dashboard.service.ts
const prisma_1 = require("../../db/prisma");
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}
function rangeToDates(key) {
    const now = new Date();
    const to = endOfDay(now);
    let from;
    if (key === "today") {
        from = startOfDay(now);
    }
    else if (key === "7d") {
        from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    }
    else {
        from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    }
    return { from, to };
}
function isoDay(d) {
    // YYYY-MM-DD (UTC) to match SQLite strftime('%Y-%m-%d', ...)
    return d.toISOString().slice(0, 10);
}
function buildDaySeries(from, to) {
    const days = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur.getTime() <= end.getTime()) {
        days.push(isoDay(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}
exports.dashboardService = {
    summary: async (q) => {
        const { from, to } = rangeToDates(q.range);
        const dateWhere = { gte: from, lte: to };
        const wh = q.warehouseId ? { warehouseId: q.warehouseId } : {};
        // --- KPI core
        const [salesPostedCount, salesAgg] = await Promise.all([
            prisma_1.prisma.sale.count({
                where: { ...wh, status: "POSTED", createdAt: dateWhere },
            }),
            prisma_1.prisma.sale.aggregate({
                where: { ...wh, status: "POSTED", createdAt: dateWhere },
                _sum: { totalTTC: true },
            }),
        ]);
        const [invoicesCount, invoicesIssuedCount] = await Promise.all([
            prisma_1.prisma.invoice.count({
                where: { ...wh, createdAt: dateWhere },
            }),
            prisma_1.prisma.invoice.count({
                where: { ...wh, status: "ISSUED", createdAt: dateWhere },
            }),
        ]);
        const invoicesPendingFneCount = await prisma_1.prisma.invoice.count({
            where: {
                ...wh,
                createdAt: dateWhere,
                OR: [{ fneStatus: "PENDING" }, { fneStatus: null }],
            },
        });
        const [deliveriesCount, deliveriesOutCount] = await Promise.all([
            prisma_1.prisma.delivery.count({
                where: { ...wh, createdAt: dateWhere },
            }),
            prisma_1.prisma.delivery.count({
                where: {
                    ...wh,
                    createdAt: dateWhere,
                    status: { in: ["OUT_FOR_DELIVERY", "PARTIALLY_DELIVERED"] },
                },
            }),
        ]);
        const purchasesOpenCount = await prisma_1.prisma.purchaseOrder.count({
            where: {
                ...wh,
                createdAt: dateWhere,
                status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
            },
        });
        // --- Alerts ("pro" but V1 safe)
        // Low stock: V1 = quantity <= 0 (tu pourras upgrader plus tard avec seuil/minStock)
        const [lowStockCount, fneErrorCount, unpaidInvoicesCount] = await Promise.all([
            prisma_1.prisma.stockItem.count({
                where: {
                    ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
                    quantity: { lte: 0 },
                },
            }),
            prisma_1.prisma.invoice.count({
                where: {
                    ...wh,
                    createdAt: dateWhere,
                    fneStatus: "ERROR",
                },
            }),
            prisma_1.prisma.invoice.count({
                where: {
                    ...wh,
                    createdAt: dateWhere,
                    OR: [
                        { paymentStatus: "UNPAID" },
                        // fallback si jamais paymentStatus est mal maintenu
                        { amountPaid: { lt: 0 } },
                    ],
                },
            }),
        ]);
        // --- Charts
        // dailyRevenueTTC (POSTED sales) and topProducts (POSTED lines)
        const hasWarehouse = Boolean(q.warehouseId);
        const dailyRows = hasWarehouse
            ? await prisma_1.prisma.$queryRaw `
          SELECT
            strftime('%Y-%m-%d', s."createdAt") as day,
            COALESCE(SUM(s."totalTTC"), 0) as total
          FROM "Sale" s
          WHERE
            s."status" = 'POSTED'
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
            AND s."warehouseId" = ${q.warehouseId}
          GROUP BY day
          ORDER BY day ASC
        `
            : await prisma_1.prisma.$queryRaw `
          SELECT
            strftime('%Y-%m-%d', s."createdAt") as day,
            COALESCE(SUM(s."totalTTC"), 0) as total
          FROM "Sale" s
          WHERE
            s."status" = 'POSTED'
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
          GROUP BY day
          ORDER BY day ASC
        `;
        const seriesDays = buildDaySeries(from, to);
        const byDay = new Map();
        for (const r of dailyRows) {
            const n = typeof r.total === "bigint" ? Number(r.total) : Number(r.total ?? 0);
            byDay.set(r.day, Number.isFinite(n) ? n : 0);
        }
        const dailyRevenueTTC = seriesDays.map((date) => ({
            date,
            totalTTC: byDay.get(date) ?? 0,
        }));
        const topRows = hasWarehouse
            ? await prisma_1.prisma.$queryRaw `
          SELECT
            p."id" as productId,
            p."sku" as sku,
            p."name" as name,
            COALESCE(SUM(sl."qty"), 0) as qty,
            COALESCE(SUM(sl."qty" * sl."unitPrice"), 0) as revenue
          FROM "SaleLine" sl
          JOIN "Sale" s ON s."id" = sl."saleId"
          JOIN "Product" p ON p."id" = sl."productId"
          WHERE
            s."status" = 'POSTED'
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
            AND s."warehouseId" = ${q.warehouseId}
          GROUP BY p."id"
          ORDER BY revenue DESC
          LIMIT 5
        `
            : await prisma_1.prisma.$queryRaw `
          SELECT
            p."id" as productId,
            p."sku" as sku,
            p."name" as name,
            COALESCE(SUM(sl."qty"), 0) as qty,
            COALESCE(SUM(sl."qty" * sl."unitPrice"), 0) as revenue
          FROM "SaleLine" sl
          JOIN "Sale" s ON s."id" = sl."saleId"
          JOIN "Product" p ON p."id" = sl."productId"
          WHERE
            s."status" = 'POSTED'
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
          GROUP BY p."id"
          ORDER BY revenue DESC
          LIMIT 5
        `;
        const topProducts = topRows.map((r) => {
            const qty = typeof r.qty === "bigint" ? Number(r.qty) : Number(r.qty ?? 0);
            const revenue = typeof r.revenue === "bigint" ? Number(r.revenue) : Number(r.revenue ?? 0);
            return {
                productId: r.productId,
                name: r.name ?? "",
                qty: Number.isFinite(qty) ? qty : 0,
                totalTTC: Number.isFinite(revenue) ? revenue : 0,
            };
        });
        // --- Recent lists (compact)
        const [recentSales, recentInvoices, recentDeliveries] = await Promise.all([
            prisma_1.prisma.sale.findMany({
                where: { ...wh, createdAt: dateWhere },
                orderBy: { createdAt: "desc" },
                take: 6,
                include: { client: true },
            }),
            prisma_1.prisma.invoice.findMany({
                where: { ...wh, createdAt: dateWhere },
                orderBy: { createdAt: "desc" },
                take: 6,
                include: { client: true },
            }),
            prisma_1.prisma.delivery.findMany({
                where: { ...wh, createdAt: dateWhere },
                orderBy: { createdAt: "desc" },
                take: 6,
                include: { sale: true },
            }),
        ]);
        return {
            range: { key: q.range, from: from.toISOString(), to: to.toISOString() },
            kpis: {
                salesPostedCount,
                salesRevenueTTC: salesAgg._sum.totalTTC ?? 0,
                invoicesCount,
                invoicesIssuedCount,
                invoicesPendingFneCount,
                deliveriesCount,
                deliveriesOutCount,
                purchasesOpenCount,
            },
            alerts: {
                lowStockCount,
                fneErrorCount,
                unpaidInvoicesCount,
            },
            charts: {
                dailyRevenueTTC,
                topProducts,
            },
            recent: {
                sales: recentSales.map((s) => ({
                    id: s.id,
                    number: s.number,
                    status: s.status,
                    totalTTC: s.totalTTC,
                    createdAt: s.createdAt.toISOString(),
                    clientName: s.client?.name ?? null,
                })),
                invoices: recentInvoices.map((i) => ({
                    id: i.id,
                    number: i.number,
                    status: i.status,
                    fneStatus: i.fneStatus ?? null,
                    totalTTC: i.totalTTC,
                    createdAt: i.createdAt.toISOString(),
                    clientName: i.client?.name ?? null,
                })),
                deliveries: recentDeliveries.map((d) => ({
                    id: d.id,
                    number: d.number,
                    status: d.status,
                    createdAt: d.createdAt.toISOString(),
                    saleNumber: d.sale?.number ?? null,
                })),
            },
        };
    },
};
