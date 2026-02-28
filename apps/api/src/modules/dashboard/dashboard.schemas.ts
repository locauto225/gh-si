// apps/api/src/modules/dashboard/dashboard.schemas.ts
import { z } from "zod";

export const dashboardRangeSchema = z.enum(["today", "7d", "30d"]);

export const dashboardSummaryQuerySchema = z.object({
  range: dashboardRangeSchema.default("7d"),
  warehouseId: z.string().optional(),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export type DashboardSummary = {
  range: { key: "today" | "7d" | "30d"; from: string; to: string };
  kpis: {
    salesPostedCount: number;
    salesRevenueTTC: number;
    invoicesCount: number;
    invoicesIssuedCount: number;
    invoicesPendingFneCount: number;
    deliveriesCount: number;
    deliveriesOutCount: number;
    purchasesOpenCount: number;
  };
  alerts: {
    lowStockCount: number;
    fneErrorCount: number;
    unpaidInvoicesCount: number;
  };
  charts: {
    dailyRevenueTTC: Array<{ date: string; totalTTC: number }>;
    topProducts: Array<{
      productId: string;
      name: string;
      qty: number;
      totalTTC: number;
    }>;
  };
  recent: {
    sales: Array<{
      id: string;
      number: string;
      status: string;
      totalTTC: number;
      createdAt: string;
      clientName: string | null;
    }>;
    invoices: Array<{
      id: string;
      number: string;
      status: string;
      fneStatus: string | null;
      totalTTC: number;
      createdAt: string;
      clientName: string | null;
    }>;
    deliveries: Array<{
      id: string;
      number: string;
      status: string;
      createdAt: string;
      saleNumber: string | null;
    }>;
  };
};