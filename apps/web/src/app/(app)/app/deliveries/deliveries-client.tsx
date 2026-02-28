"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { Plus, ChevronDown, Package, Store, ClipboardList } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Warehouse = { id: string; code: string; name: string; isActive: boolean };
type Driver    = { id: string; name: string; phone?: string | null; isActive?: boolean };

type DeliveryRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  preparedAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  warehouse?: Warehouse | null;
  driver?: Driver | null;
  trip?: { id: string; number: string; status?: string } | null;
  stop?: { id: string; sequence: number; status: string } | null;
  sale?: {
    id: string;
    number: string;
    client?: { id: string; name: string } | null;
  } | null;
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function fmtDate(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch { return String(dt); }
}

// ─── Labels & badges ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT:               "Brouillon",
  PREPARED:            "Préparé",
  OUT_FOR_DELIVERY:    "En livraison",
  PARTIALLY_DELIVERED: "Livré partiellement",
  DELIVERED:           "Livré",
  FAILED:              "Échec",
  CANCELLED:           "Annulé",
};

const STOP_STATUS_LABELS: Record<string, string> = {
  PENDING:   "En attente",
  VISITED:   "Visité",
  PARTIAL:   "Partiel",
  DONE:      "Livré",
  FAILED:    "Échec",
  CANCELLED: "Annulé",
};

const STATUS_CLS: Record<string, string> = {
  DRAFT:               "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  PREPARED:            "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300",
  OUT_FOR_DELIVERY:    "border-primary/30 bg-primary/5 text-primary dark:text-orange-300",
  PARTIALLY_DELIVERED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  DELIVERED:           "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  FAILED:              "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  CANCELLED:           "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
};

const STOP_CLS: Record<string, string> = {
  PENDING:   "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400",
  VISITED:   "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  PARTIAL:   "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  DONE:      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  FAILED:    "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLS[status] ?? STATUS_CLS.DRAFT;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StopBadge({ status }: { status: string }) {
  const cls = STOP_CLS[status] ?? STOP_CLS.PENDING;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {STOP_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Bouton "Nouveau BL" avec dropdown ───────────────────────────────────────

function NewBLButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  return (
    <div ref={ref} className="relative" onBlur={onBlur}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Nouveau BL
        <ChevronDown className={["h-3.5 w-3.5 transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg ring-1 ring-border/60">
          <button
            type="button"
            tabIndex={0}
            onClick={() => { setOpen(false); router.push("/app/deliveries/new?mode=order"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="font-medium text-foreground">Depuis une commande</div>
              <div className="text-xs text-muted">Livraison dépôt (B2B)</div>
            </div>
          </button>

          <div className="border-t border-border" />

          <button
            type="button"
            tabIndex={0}
            onClick={() => { setOpen(false); router.push("/app/deliveries/new?mode=sale"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            <Package className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
            <div>
              <div className="font-medium text-foreground">Depuis une vente</div>
              <div className="text-xs text-muted">Livraison comptoir</div>
            </div>
          </button>

          <div className="border-t border-border" />

          <button
            type="button"
            tabIndex={0}
            onClick={() => { setOpen(false); router.push("/app/deliveries/new?mode=internal"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            <Store className="h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <div className="font-medium text-foreground">Réassort magasin</div>
              <div className="text-xs text-muted">Mouvement interne</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Filtres ─────────────────────────────────────────────────────────────────

const STATUS_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Tous les statuts",        value: "all" },
  { label: "Préparés",                value: "PREPARED" },
  { label: "En livraison",            value: "OUT_FOR_DELIVERY" },
  { label: "Livrés partiellement",    value: "PARTIALLY_DELIVERED" },
  { label: "Livrés",                  value: "DELIVERED" },
  { label: "Livrés + Partiels",       value: "DELIVERED,PARTIALLY_DELIVERED" },
  { label: "Échec",                   value: "FAILED" },
  { label: "Annulés",                 value: "CANCELLED" },
];

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DeliveriesClient() {
  const [items, setItems]         = useState<DeliveryRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [drivers, setDrivers]     = useState<Driver[]>([]);

  // Filtres
  const [status, setStatus]         = useState("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [driverId, setDriverId]     = useState("");
  const [q, setQ]                   = useState("");
  const [limit, setLimit]           = useState(50);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    if (status && status !== "all") p.set("status", status);
    if (warehouseId) p.set("warehouseId", warehouseId);
    if (driverId) p.set("driverId", driverId);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [status, warehouseId, driverId, q, limit]);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ items: DeliveryRow[] }>(`/deliveries?${qs}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Erreur lors du chargement.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [wRes, dRes] = await Promise.all([
          apiGet<{ items: Warehouse[] }>("/warehouses?status=active"),
          apiGet<{ items: Driver[] }>("/drivers?status=active"),
        ]);
        setWarehouses(wRes.items ?? []);
        setDrivers(dRes.items ?? []);
      } catch { /* silencieux */ }
    })();
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [qs]);

  const hasActiveFilters = status !== "all" || warehouseId || driverId || q;

  function resetFilters() {
    setStatus("all"); setWarehouseId(""); setDriverId(""); setQ(""); setLimit(50);
  }

  return (
    <div className="space-y-5">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] disabled:opacity-50"
        >
          Rafraîchir
        </button>
        <NewBLButton />
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/60">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {/* Statut */}
          <div>
            <label className="text-xs text-muted">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
            >
              {STATUS_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Entrepôt */}
          <div>
            <label className="text-xs text-muted">Entrepôt</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
            >
              <option value="">Tous les entrepôts</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          {/* Livreur */}
          {drivers.length > 0 && (
            <div>
              <label className="text-xs text-muted">Livreur</label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
              >
                <option value="">Tous les livreurs</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Recherche */}
          <div className={drivers.length === 0 ? "lg:col-span-2" : ""}>
            <label className="text-xs text-muted">Recherche</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° BL, vente, client…"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
            />
          </div>
        </div>

        {/* Ligne basse : limite + reset */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">Afficher</label>
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={String(n)}>{n} résultats</option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Erreur ──────────────────────────────────────────────────────────── */}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">
        <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
          <div className="text-sm font-medium text-foreground">
            {loading ? "Chargement…" : "Liste des bons de livraison"}
          </div>
          {hasActiveFilters && !loading && (
            <div className="text-xs text-muted">Filtres actifs</div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {hasActiveFilters ? "Aucun bon de livraison pour ces critères." : "Aucun bon de livraison."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">N° BL</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Client / Type</th>
                  <th className="px-4 py-3">Vente</th>
                  <th className="px-4 py-3">Tournée · Arrêt</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3">Livreur</th>
                  <th className="px-4 py-3">Dernière étape</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => {
                  const lastStep = d.deliveredAt
                    ? `Livré · ${fmtDate(d.deliveredAt)}`
                    : d.dispatchedAt
                    ? `Parti · ${fmtDate(d.dispatchedAt)}`
                    : d.preparedAt
                    ? `Préparé · ${fmtDate(d.preparedAt)}`
                    : `Créé · ${fmtDate(d.createdAt)}`;

                  return (
                    <tr
                      key={d.id}
                      className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
                    >
                      {/* N° BL */}
                      <td className="px-4 py-3 font-mono font-semibold">
                        <Link href={`/app/deliveries/${d.id}`} className="hover:underline underline-offset-4">
                          {d.number}
                        </Link>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>

                      {/* Client / Type */}
                      <td className="px-4 py-3">
                        {d.sale
                          ? (d.sale.client?.name ?? <span className="text-muted">Comptoir</span>)
                          : <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <Store className="h-3.5 w-3.5" /> Réassort
                            </span>
                        }
                      </td>

                      {/* Vente — ✅ lien corrigé /app/sales/ */}
                      <td className="px-4 py-3">
                        {d.sale?.number ? (
                          <Link href={`/app/sales/${d.sale.id}`} className="text-sm hover:underline underline-offset-4">
                            {d.sale.number}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Tournée · Arrêt — ✅ lien arrêt corrigé → fiche tournée */}
                      <td className="px-4 py-3">
                        {d.trip ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link href={`/app/trips/${d.trip.id}`} className="text-sm hover:underline underline-offset-4">
                              {d.trip.number}
                            </Link>
                            {d.stop && (
                              <>
                                <span className="text-muted">·</span>
                                <span className="text-xs text-muted">#{d.stop.sequence}</span>
                                <StopBadge status={d.stop.status} />
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">Non affecté</span>
                        )}
                      </td>

                      {/* Entrepôt */}
                      <td className="px-4 py-3">
                        {d.warehouse ? (
                          <span>
                            {d.warehouse.name}{" "}
                            <span className="text-xs text-muted">({d.warehouse.code})</span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Livreur */}
                      <td className="px-4 py-3 text-muted">
                        {d.driver?.name ?? "—"}
                      </td>

                      {/* Dernière étape */}
                      <td className="px-4 py-3 text-xs text-muted">
                        {lastStep}
                      </td>
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