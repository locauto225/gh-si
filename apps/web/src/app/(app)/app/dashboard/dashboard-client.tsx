// apps/web/src/app/(app)/app/dashboard/dashboard-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiGet } from "@/lib/api";
import {
  Card as UICard,
  SectionCard as UISectionCard,
  StatPill as UIStatPill,
  EmptyState as UIEmptyState,
  RecentRow as UIRecentRow,
} from "@/components/ui/Card";

type DashboardSummary = {
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
    topProducts: Array<{ productId: string; sku: string | null; name: string; qty: number; totalTTC: number }>;
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

type RangeKey = "today" | "7d" | "30d";
type Warehouse = { id: string; code: string; name: string; isActive: boolean };

// ✅ Labels métier pour les statuts — plus de codes bruts affichés
const STATUS_LABELS: Record<string, string> = {
  // Ventes
  DRAFT: "Brouillon",
  POSTED: "Validée",
  CANCELLED: "Annulée",
  // Factures
  ISSUED: "Émise",
  SENT: "Transmise",
  ACCEPTED: "Acceptée",
  ERROR: "Erreur",
  // FNE
  PENDING: "En attente",
  // Livraisons
  PREPARING: "En préparation",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En cours",
  DELIVERED: "Livrée",
  PARTIALLY_DELIVERED: "Partielle",
  RECEIVED: "Reçue",
  PARTIALLY_RECEIVED: "Partiellement reçue",
};

// ✅ Labels des périodes — dynamiques pour les titres
const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Aujourd'hui",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
};

function statusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABELS[s.toUpperCase()] ?? s;
}

function fmtXof(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(n ?? 0);
  } catch {
    return String(n ?? 0);
  }
}

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function fmtDateShort(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function toneBadge(v: string | null | undefined) {
  const s = String(v ?? "").toUpperCase();
  if (s === "POSTED" || s === "RECEIVED" || s === "DELIVERED" || s === "ACCEPTED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
  }
  if (s === "DRAFT") {
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
  }
  if (s === "CANCELLED" || s === "ERROR") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";
  }
  if (s === "OUT_FOR_DELIVERY" || s === "PARTIALLY_RECEIVED" || s === "PARTIALLY_DELIVERED") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200";
  }
  if (s === "PENDING" || s === "SENT" || s === "ISSUED") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
}

function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

// ─── RecentList ──────────────────────────────────────────────────────────────
function RecentList({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const sp = new URLSearchParams({ range });
    if (warehouseId) sp.set("warehouseId", warehouseId);
    return sp.toString();
  }, [range, warehouseId]);

  // ✅ Fallbacks en useMemo — plus d'IIFE dans le JSX
  const kpis = useMemo(
    () =>
      data?.kpis ?? {
        salesPostedCount: 0,
        salesRevenueTTC: 0,
        invoicesCount: 0,
        invoicesIssuedCount: 0,
        invoicesPendingFneCount: 0,
        deliveriesCount: 0,
        deliveriesOutCount: 0,
        purchasesOpenCount: 0,
      },
    [data]
  );
  const alerts = useMemo(
    () => data?.alerts ?? { lowStockCount: 0, fneErrorCount: 0, unpaidInvoicesCount: 0 },
    [data]
  );
  const charts = useMemo(
    () => data?.charts ?? { dailyRevenueTTC: [], topProducts: [] },
    [data]
  );
  const recent = useMemo(
    () => data?.recent ?? { sales: [], invoices: [], deliveries: [] },
    [data]
  );

  async function loadWarehouses() {
    setWarehousesLoading(true);
    try {
      const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active");
      setWarehouses(res.items ?? []);
    } catch {
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<DashboardSummary>(`/dashboard/summary?${query}`);
      setData(res);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du chargement du tableau de bord"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const rangeLabel = RANGE_LABELS[range];

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Période */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            <option value="today">Aujourd'hui</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>

          {/* Entrepôt */}
          <div className="min-w-[220px]">
            <label className="sr-only" htmlFor="warehouseId">Entrepôt</label>
            <select
              id="warehouseId"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={warehousesLoading}
              className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] disabled:opacity-60"
            >
              <option value="">Tous les entrepôts</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            Rafraîchir
          </button>
        </div>

        {/* ✅ Plage de dates lisible — "du … au …" */}
        {data && (
          <div className="text-xs text-muted">
            Du {fmtDateShort(data.range.from)} au {fmtDateShort(data.range.to)}
          </div>
        )}
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted shadow-sm">
          {/* ✅ "Chargement…" avec ellipse correcte */}
          Chargement…
        </div>
      ) : data ? (
        <>
          {/* KPIs principaux */}
          <div className="grid gap-3 md:grid-cols-4">
            <UIStatPill label="Ventes validées" value={kpis.salesPostedCount} />
            <UIStatPill label="Chiffre d'affaires TTC" value={fmtXof(kpis.salesRevenueTTC)} />
            <UIStatPill label="Factures" value={kpis.invoicesCount} sub={`${kpis.invoicesIssuedCount} émises`} />
            <UIStatPill label="FNE en attente" value={kpis.invoicesPendingFneCount} sub="À transmettre à la FNE" />
          </div>

          {/* Alertes */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-foreground mr-1">
              Alertes
            </div>
            <Link
              href="/app/stock"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] ${
                alerts.lowStockCount > 0
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                  : "border-border bg-card text-muted hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
              }`}
            >
              Stock faible
              <span className="font-semibold">{alerts.lowStockCount}</span>
            </Link>
            <Link
              href="/app/invoices?fneStatus=ERROR"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] ${
                alerts.fneErrorCount > 0
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                  : "border-border bg-card text-muted hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
              }`}
            >
              Erreurs FNE
              <span className="font-semibold">{alerts.fneErrorCount}</span>
            </Link>
            <Link
              href="/app/invoices?paymentStatus=UNPAID"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] ${
                alerts.unpaidInvoicesCount > 0
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                  : "border-border bg-card text-muted hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
              }`}
            >
              Factures impayées
              <span className="font-semibold">{alerts.unpaidInvoicesCount}</span>
            </Link>
          </div>

          {/* Graphiques */}
          <div className="grid gap-3 md:grid-cols-2">
            <UICard>
              <div className="mb-3 text-sm font-medium text-foreground">Chiffre d'affaires — {rangeLabel}</div>
              <MiniBarChart data={charts.dailyRevenueTTC} />
            </UICard>
            <UICard>
              <div className="mb-3 text-sm font-medium text-foreground">Produits les plus vendus — {rangeLabel}</div>
              {charts.topProducts.length === 0 ? (
                <UIEmptyState>Aucune vente sur cette période.</UIEmptyState>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {charts.topProducts.map((p) => (
                    <div key={p.productId} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{p.name}</div>
                        {p.sku ? <div className="truncate text-xs text-muted">{p.sku}</div> : null}
                      </div>
                      <div className="ml-3 flex flex-col items-end">
                        <span className="tabular-nums font-semibold text-foreground">{fmtXof(p.totalTTC)}</span>
                        <span className="text-xs text-muted">{p.qty} unité{p.qty > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </UICard>
          </div>

          {/* Stats secondaires + accès rapides */}
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="grid gap-3 sm:grid-cols-3">
                <UIStatPill label="Livraisons" value={kpis.deliveriesCount} />
                <UIStatPill label="En livraison" value={kpis.deliveriesOutCount} />
                <UIStatPill label="Achats en cours" value={kpis.purchasesOpenCount} />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Link
                  href="/app/orders"
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-border/60 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
                >
                  Ventes
                  <div className="mt-1 text-xs font-normal text-muted">
                    Créer · valider · facturer
                  </div>
                </Link>
                <Link
                  href="/app/invoices"
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-border/60 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
                >
                  Factures
                  <div className="mt-1 text-xs font-normal text-muted">
                    Émettre · envoyer FNE
                  </div>
                </Link>
                <Link
                  href="/app/deliveries"
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-border/60 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
                >
                  Livraisons
                  <div className="mt-1 text-xs font-normal text-muted">
                    Préparer · livrer · suivi
                  </div>
                </Link>
              </div>
            </div>

            {/* À surveiller */}
            <div className="lg:col-span-5">
              <UICard>
                <div className="mb-3 text-sm font-medium text-foreground">À surveiller</div>
                <div className="grid gap-2">
                  {[
                    { label: "FNE en attente", value: kpis.invoicesPendingFneCount, tone: "PENDING" },
                    { label: "Livraisons en cours", value: kpis.deliveriesOutCount, tone: "OUT_FOR_DELIVERY" },
                    { label: "Achats en cours", value: kpis.purchasesOpenCount, tone: "ORDERED" },
                  ].map(({ label, value, tone }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-3 py-2 text-sm"
                    >
                      <div className="text-foreground">{label}</div>
                      <div className={`tabular-nums rounded-full border px-2 py-0.5 text-xs font-medium ${toneBadge(tone)}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </UICard>
            </div>
          </div>

          {/* Activité récente */}
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <UISectionCard
                title="Ventes récentes"
                right={
                  <Link href="/app/orders" className="text-xs text-muted hover:underline">
                    Voir tout →
                  </Link>
                }
              >
                {recent.sales.length === 0 ? (
                  <UIEmptyState>Aucune vente sur cette période.</UIEmptyState>
                ) : (
                  <RecentList>
                    {recent.sales.slice(0, 6).map((s) => (
                      <UIRecentRow
                        key={s.id}
                        href={`/app/orders/${s.id}`}
                        title={s.number}
                        subtitle={`${fmtDate(s.createdAt)} · ${s.clientName ?? "—"}`}
                        badge={
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneBadge(s.status)}`}>
                            {statusLabel(s.status)}
                          </span>
                        }
                        right={fmtXof(s.totalTTC)}
                      />
                    ))}
                  </RecentList>
                )}
              </UISectionCard>
            </div>

            <div className="lg:col-span-6">
              <UISectionCard
                title="Factures récentes"
                right={
                  <Link href="/app/invoices" className="text-xs text-muted hover:underline">
                    Voir tout →
                  </Link>
                }
              >
                {recent.invoices.length === 0 ? (
                  <UIEmptyState>Aucune facture sur cette période.</UIEmptyState>
                ) : (
                  <RecentList>
                    {recent.invoices.slice(0, 6).map((i) => {
                      const displayStatus = i.fneStatus ?? i.status;
                      return (
                        <UIRecentRow
                          key={i.id}
                          href={`/app/invoices/${i.id}`}
                          title={i.number}
                          subtitle={`${fmtDate(i.createdAt)} · ${i.clientName ?? "—"}`}
                          badge={
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneBadge(displayStatus)}`}>
                              {statusLabel(displayStatus)}
                            </span>
                          }
                          right={fmtXof(i.totalTTC)}
                        />
                      );
                    })}
                  </RecentList>
                )}
              </UISectionCard>
            </div>

            <div className="lg:col-span-12">
              <UISectionCard
                title="Livraisons récentes"
                right={
                  <Link href="/app/deliveries" className="text-xs text-muted hover:underline">
                    Voir tout →
                  </Link>
                }
              >
                {recent.deliveries.length === 0 ? (
                  <UIEmptyState>Aucune livraison sur cette période.</UIEmptyState>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {recent.deliveries.slice(0, 8).map((d) => (
                      <UIRecentRow
                        key={d.id}
                        href={`/app/deliveries/${d.id}`}
                        title={d.number}
                        subtitle={`${fmtDate(d.createdAt)} · Vente ${d.saleNumber ?? "—"}`}
                        badge={
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneBadge(d.status)}`}>
                            {statusLabel(d.status)}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
              </UISectionCard>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── MiniBarChart ─────────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: Array<{ date: string; totalTTC: number }> }) {
  if (!data || data.length === 0) {
    return <EmptyState>Aucune donnée sur cette période.</EmptyState>;
  }
  const max = Math.max(...data.map((x) => x.totalTTC), 1);
  return (
    <div className="flex flex-col items-stretch">
      <div className="flex items-end h-24 gap-1 mb-2">
        {data.map((d, idx) => (
          <div
            key={`${d.date ?? ""}-${idx}`}
            style={{
              height: `${Math.round((d.totalTTC / max) * 100)}%`,
              minWidth: "16px",
              background: "linear-gradient(180deg, #fbbf24 0%, #f59e42 100%)",
              borderRadius: "4px 4px 0 0",
              opacity: d.totalTTC === 0 ? 0.3 : 1,
            }}
            className="flex-1 transition-all duration-300"
            title={fmtXof(d.totalTTC)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        {data.map((d, idx) => {
          const parts = String(d.date ?? "").split("-");
          const month = parts[1] ?? "";
          const day = parts[2] ?? "";
          return (
            <span
              key={`${d.date ?? ""}-label-${idx}`}
              style={{ minWidth: "16px", textAlign: "center" }}
            >
              {day && month ? `${day}/${month}` : "—"}
            </span>
          );
        })}
      </div>
    </div>
  );
}