"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api";
import { AlertCircle, RefreshCw, ReceiptText, CircleDollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "DRAFT" | "ISSUED" | "SENT" | "ACCEPTED" | "ERROR" | "CANCELLED";
type FneStatus = "PENDING" | "SENT" | "ERROR" | null;

type Client    = { id: string; name: string };
type Warehouse = { id: string; code: string; name: string };

type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  total: number;
  clientId?: string | null;
  client?: Client | null;
  warehouseId: string;
  warehouse?: Warehouse | null;
  fneStatus?: FneStatus;
  fneLastError?: string | null;
  fneSentAt?: string | null;
  createdAt: string;
};

type StatusFilter = "all" | InvoiceStatus;
type FneFilter    = "all" | "PENDING" | "SENT" | "ERROR";

// ─── Labels ───────────────────────────────────────────────────────────────────

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT:     "Brouillon",
  ISSUED:    "Émise",
  SENT:      "Transmise",
  ACCEPTED:  "Validée",
  ERROR:     "Erreur",
  CANCELLED: "Annulée",
};

const FNE_STATUS_LABELS: Record<Exclude<FneStatus, null>, string> = {
  PENDING: "En attente",
  SENT:    "Envoyée",
  ERROR:   "Erreur",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "XOF", maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(dt));
  } catch { return dt; }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "slate";
}) {
  const cls =
    tone === "green"  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
    : tone === "red"   ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
    : tone === "slate" ? "border-border bg-card text-muted"
    : "border-border bg-card text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function getStatusTone(s: InvoiceStatus): "green" | "amber" | "red" | "slate" | "neutral" {
  if (s === "ACCEPTED" || s === "SENT") return "green";
  if (s === "ISSUED")    return "amber";
  if (s === "ERROR")     return "red";
  return "slate";
}

function getFneTone(fne: FneStatus): "green" | "amber" | "red" | "slate" {
  if (fne === "SENT")    return "green";
  if (fne === "PENDING") return "amber";
  if (fne === "ERROR")   return "red";
  return "slate";
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const iconCls =
    tone === "green"  ? "text-emerald-500"
    : tone === "amber" ? "text-amber-500"
    : tone === "red"   ? "text-red-500"
    : "text-muted";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`shrink-0 rounded-lg border border-border p-2 ${tone === "red" ? "bg-red-50 dark:bg-red-950/20" : tone === "amber" ? "bg-amber-50 dark:bg-amber-950/20" : tone === "green" ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"}`}>
        <Icon className={`h-4 w-4 ${iconCls}`} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-base font-bold tabular-nums text-foreground leading-tight">{value}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Tooltip FNE erreur ───────────────────────────────────────────────────────

function FneCell({ inv }: { inv: Invoice }) {
  const [show, setShow] = useState(false);

  if (!inv.fneStatus) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Badge tone={getFneTone(inv.fneStatus)}>
          {FNE_STATUS_LABELS[inv.fneStatus]}
        </Badge>
        {inv.fneStatus === "ERROR" && inv.fneLastError && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShow(true)}
              onMouseLeave={() => setShow(false)}
              className="text-red-500 hover:text-red-700"
            >
              <AlertCircle className="h-3.5 w-3.5" />
            </button>
            {show && (
              <div className="absolute bottom-full left-1/2 z-30 mb-1.5 w-64 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
                <div className="font-medium text-red-600 dark:text-red-400 mb-1">Erreur FNE</div>
                {inv.fneLastError}
              </div>
            )}
          </div>
        )}
      </div>
      {inv.fneSentAt && (
        <div className="text-xs text-muted">{fmtDate(inv.fneSentAt)}</div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function InvoicesClient() {
  const router = useRouter();

  const [items, setItems]     = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [fne, setFne]       = useState<FneFilter>("all");
  const [q, setQ]           = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (fne !== "all")    params.set("fneStatus", fne);
    const qq = q.trim();
    if (qq) params.set("q", qq);
    params.set("limit", "100");
    return params.toString();
  }, [status, fne, q]);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ items: Invoice[] }>(`/invoices?${queryString}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Erreur lors du chargement");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [queryString]);

  // ── Stats dérivées ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total      = items.length;
    const montant    = items.reduce((s, i) => s + (i.total ?? 0), 0);
    const fneErrors  = items.filter((i) => i.fneStatus === "ERROR").length;
    const validated  = items.filter((i) => i.status === "ACCEPTED").length;
    return { total, montant, fneErrors, validated };
  }, [items]);

  const hasActiveFilters = status !== "all" || fne !== "all" || q.trim() !== "";

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-foreground">Factures</div>
          <div className="text-sm text-muted">
            Suivi des factures clients · statut, FNE, montants.
          </div>
        </div>
        <Link
          href="/app/invoices/new"
          className="self-start rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          + Nouvelle facture
        </Link>
      </div>

      {/* Stats */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total factures"
            value={String(stats.total)}
            icon={ReceiptText}
          />
          <StatCard
            label="Montant total"
            value={formatXOF(stats.montant)}
            icon={CircleDollarSign}
            tone="neutral"
          />
          <StatCard
            label="Validées"
            value={String(stats.validated)}
            sub={stats.total ? `${Math.round((stats.validated / stats.total) * 100)} %` : undefined}
            icon={CheckCircle2}
            tone="green"
          />
          <StatCard
            label="Erreurs FNE"
            value={String(stats.fneErrors)}
            sub={stats.fneErrors > 0 ? "À corriger" : "Tout est OK"}
            icon={AlertTriangle}
            tone={stats.fneErrors > 0 ? "red" : "green"}
          />
        </div>
      )}

      {/* Filtres */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-12">

          <div className="md:col-span-4">
            <label className="text-xs text-muted">Recherche</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° facture, client…"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-muted">Statut facture</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring focus:ring-primary/20"
            >
              <option value="all">Tous les statuts</option>
              <option value="DRAFT">Brouillons</option>
              <option value="ISSUED">Émises</option>
              <option value="SENT">Transmises</option>
              <option value="ACCEPTED">Validées</option>
              <option value="ERROR">En erreur</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-muted">Statut FNE</label>
            <select
              value={fne}
              onChange={(e) => setFne(e.target.value as FneFilter)}
              className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring focus:ring-primary/20"
            >
              <option value="all">Tous</option>
              <option value="PENDING">En attente</option>
              <option value="SENT">Envoyées</option>
              <option value="ERROR">Erreur</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end justify-end gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setQ(""); setStatus("all"); setFne("all"); }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] hover:text-foreground transition-colors"
              >
                Réinitialiser
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rafraîchir
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {err}
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-3">
          <div className="text-sm font-semibold text-foreground">Factures</div>
          <div className="text-xs text-muted">
            {loading ? "Chargement…" : `${items.length} facture${items.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {hasActiveFilters
              ? "Aucune facture ne correspond aux filtres."
              : "Aucune facture."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">N° facture</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3 text-right">Total TTC</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">FNE</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/app/invoices/${inv.id}`)}
                    className="cursor-pointer border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_8%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {inv.number}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {inv.client?.name ?? (
                        <span className="italic text-muted">Comptoir</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {inv.warehouse?.name ?? "—"}
                      {inv.warehouse?.code && (
                        <span className="ml-1 text-xs opacity-60">({inv.warehouse.code})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {formatXOF(inv.total ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={getStatusTone(inv.status)}>
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <FneCell inv={inv} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {fmtDate(inv.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}