"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";

type Client = { id: string; name: string };

type OrderStatus =
  | "all"
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

type OrderListRow = {
  id: string;
  number: string;
  status: string;

  warehouse?: { id: string; code: string; name: string } | null;
  client?: Client | null;

  totalHT?: number;
  totalTTC?: number;

  createdAt: string;
};

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  PREPARED: "Préparée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === "DELIVERED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
      : s === "SHIPPED"
      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300"
      : s === "PREPARED"
      ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300"
      : s === "CONFIRMED"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
      : s === "CANCELLED"
      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] text-muted";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  );
}

function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as any).message);
  return "Erreur lors du chargement";
}

export default function OrdersClient() {
  const [items, setItems] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<OrderStatus>("all");
  const [q, setQ] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const qq = q.trim();
    if (qq) params.set("q", qq);
    if (status && status !== "all") params.set("status", String(status));
    params.set("limit", "50");
    return params.toString();
  }, [q, status]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: OrderListRow[] }>(`/orders?${queryString}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(getErrMsg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const hasActiveFilters = status !== "all" || q.trim();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-foreground">Commandes dépôt</div>
          <div className="text-sm text-muted">B2B · Suivi des commandes : statut, client, montants, dates.</div>
        </div>

        <Link
          href="/app/orders/new"
          className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + Nouvelle commande
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="text-xs text-muted">Recherche</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° commande, nom du client…"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
            />
          </div>

          <div className="sm:w-60">
            <label className="text-xs text-muted">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
            >
              <option value="all">Tous les statuts</option>
              <option value="DRAFT">Brouillons</option>
              <option value="CONFIRMED">Confirmées</option>
              <option value="PREPARED">Préparées</option>
              <option value="SHIPPED">Expédiées</option>
              <option value="DELIVERED">Livrées</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("all");
              }}
              className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
          <div className="text-sm font-medium text-foreground">
            {loading ? "Chargement…" : `${items.length} commande${items.length !== 1 ? "s" : ""}`}
          </div>
          {hasActiveFilters && !loading && <div className="text-xs text-muted">Filtres actifs</div>}
        </div>

        {err ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {hasActiveFilters ? "Aucune commande pour ces critères." : "Aucune commande."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">N° commande</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Total TTC</th>
                  <th className="px-4 py-3">Créée</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const origin = o.warehouse ? `${o.warehouse.name} (${o.warehouse.code})` : "—";
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
                      onClick={() => (window.location.href = `/app/orders/${o.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/orders/${o.id}`}
                          className="font-mono text-xs font-semibold text-foreground hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{o.client?.name ?? <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-muted">{origin}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatXOF(o.totalTTC ?? o.totalHT ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}