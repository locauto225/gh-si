// apps/api/src/modules/dashboard/dashboard.service.ts
import { prisma } from "../../db/prisma";
import { Prisma } from "@prisma/client";
import type { DashboardSummary, DashboardSummaryQuery } from "./dashboard.schemas";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeToDates(key: "today" | "7d" | "30d") {
  const now = new Date();
  const to = endOfDay(now);
  let from: Date;

  if (key === "today") {
    from = startOfDay(now);
  } else if (key === "7d") {
    from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  } else {
    from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  }

  return { from, to };
}

function isoDay(d: Date) {
  // YYYY-MM-DD (UTC) to match SQLite strftime('%Y-%m-%d', ...)
  return d.toISOString().slice(0, 10);
}

function buildDaySeries(from: Date, to: Date) {
  const days: string[] = [];
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

export const dashboardService = {
  summary: async (q: DashboardSummaryQuery): Promise<DashboardSummary> => {
    const { from, to } = rangeToDates(q.range);
    const dateWhere = { gte: from, lte: to };
    const wh = q.warehouseId ? { warehouseId: q.warehouseId } : {};

    // --- KPI core
    const [salesPostedCount, salesAgg] = await Promise.all([
      prisma.sale.count({
        where: { ...wh, status: "POSTED", createdAt: dateWhere },
      }),
      prisma.sale.aggregate({
        where: { ...wh, status: "POSTED", createdAt: dateWhere },
        _sum: { totalTTC: true },
      }),
    ]);

    const [invoicesCount, invoicesIssuedCount] = await Promise.all([
      prisma.invoice.count({
        where: { ...wh, createdAt: dateWhere },
      }),
      prisma.invoice.count({
        where: { ...wh, status: "ISSUED", createdAt: dateWhere },
      }),
    ]);

    const invoicesPendingFneCount = await prisma.invoice.count({
      where: {
        ...wh,
        createdAt: dateWhere,
        OR: [{ fneStatus: "PENDING" }, { fneStatus: null }],
      },
    });

    const [deliveriesCount, deliveriesOutCount] = await Promise.all([
      prisma.delivery.count({
        where: { ...wh, createdAt: dateWhere },
      }),
      prisma.delivery.count({
        where: {
          ...wh,
          createdAt: dateWhere,
          status: { in: ["OUT_FOR_DELIVERY", "PARTIALLY_DELIVERED"] },
        },
      }),
    ]);

    const purchasesOpenCount = await prisma.purchaseOrder.count({
      where: {
        ...wh,
        createdAt: dateWhere,
        status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
      },
    });

    // --- Alerts ("pro" but V1 safe)
    // Low stock: V1 = quantity <= 0 (tu pourras upgrader plus tard avec seuil/minStock)
    const [lowStockCount, fneErrorCount, unpaidInvoicesCount] = await Promise.all([
      prisma.stockItem.count({
        where: {
          ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
          quantity: { lte: 0 },
        },
      }),
      prisma.invoice.count({
        where: {
          ...wh,
          createdAt: dateWhere,
          fneStatus: "ERROR",
        },
      }),
      prisma.invoice.count({
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
    const whSql = q.warehouseId
      ? Prisma.sql` AND s."warehouseId" = ${q.warehouseId} `
      : Prisma.empty;

    const dailyRows = await prisma.$queryRaw<
      { day: string; total: number | bigint | null }[]
    >(Prisma.sql`
      SELECT
        strftime('%Y-%m-%d', s."createdAt") as day,
        COALESCE(SUM(s."totalTTC"), 0) as total
      FROM "Sale" s
      WHERE
        s."status" = 'POSTED'
        AND s."createdAt" >= ${from}
        AND s."createdAt" <= ${to}
        ${whSql}
      GROUP BY day
      ORDER BY day ASC
    `);

    const seriesDays = buildDaySeries(from, to);
    const byDay = new Map<string, number>();
    for (const r of dailyRows) {
      const n = typeof r.total === "bigint" ? Number(r.total) : Number(r.total ?? 0);
      byDay.set(r.day, Number.isFinite(n) ? n : 0);
    }

    const dailyRevenueTTC = seriesDays.map((date) => ({
      date,
      totalTTC: byDay.get(date) ?? 0,
    }));

    const topRows = await prisma.$queryRaw<
      { productId: string; sku: string | null; name: string | null; qty: number | bigint | null; revenue: number | bigint | null }[]
    >(Prisma.sql`
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
        ${whSql}
      GROUP BY p."id"
      ORDER BY revenue DESC
      LIMIT 5
    `);

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
      prisma.sale.findMany({
        where: { ...wh, createdAt: dateWhere },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { client: true },
      }),
      prisma.invoice.findMany({
        where: { ...wh, createdAt: dateWhere },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { client: true },
      }),
      prisma.delivery.findMany({
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