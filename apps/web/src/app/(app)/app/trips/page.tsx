"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import {
  Route,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TripStatus = "DRAFT" | "LOADED" | "IN_PROGRESS" | "DONE" | "CLOSED" | "CANCELLED";

type TripRow = {
  id: string;
  number: string;
  status: TripStatus;
  note?: string | null;
  departureDate?: string | null; // date planifiée de départ
  createdAt: string;
  fromWarehouse?: { id: string; code: string; name: string } | null;
  driver?: { id: string; name: string } | null;
  _count?: { stops: number; deliveries: number } | null;
};

type UnassignedBL = {
  id: string;
  number: string;
  createdAt: string;
  sale?: { client?: { name: string } | null } | null;
  order?: { client?: { name: string } | null } | null;
};

// ─── Labels & styles ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TripStatus, string> = {
  DRAFT:       "En préparation",
  LOADED:      "Chargée",
  IN_PROGRESS: "En cours",
  DONE:        "Terminée",
  CLOSED:      "Clôturée",
  CANCELLED:   "Annulée",
};

const STATUS_CLS: Record<TripStatus, string> = {
  DRAFT:       "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  LOADED:      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  IN_PROGRESS: "border-primary/30 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10 dark:text-orange-300",
  DONE:        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  CLOSED:      "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
  CANCELLED:   "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
};

function StatusBadge({ status }: { status: TripStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

function isToday(dt: string | null | undefined): boolean {
  if (!dt) return false;
  const d = new Date(dt);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function isFuture(dt: string | null | undefined): boolean {
  if (!dt) return false;
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return d > n;
}

function fmtDateShort(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(new Date(dt));
  } catch {
    return "";
  }
}

// ─── Carte tournée ────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: TripRow }) {
  const router = useRouter();
  const refDate = trip.departureDate ?? trip.createdAt;
  const stops = trip._count?.stops ?? 0;
  const deliveries = trip._count?.deliveries ?? 0;

  return (
    <div
      onClick={() => router.push(`/app/trips/${trip.id}`)}
      className="group cursor-pointer rounded-xl border border-border bg-card px-4 py-3 shadow-sm ring-1 ring-border/40 transition-colors hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Infos principales */}
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground group-hover:underline underline-offset-4">
              {trip.number}
            </span>
            <StatusBadge status={trip.status} />
            {/* Point pulsant si en cours */}
            {trip.status === "IN_PROGRESS" && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {trip.driver ? (
              <span className="flex items-center gap-1.5 text-muted">
                <Truck className="h-3.5 w-3.5 shrink-0" />
                {trip.driver.name}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-warning">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Livreur non assigné
              </span>
            )}
            {trip.fromWarehouse && (
              <span className="text-muted">
                {trip.fromWarehouse.name}
                <span className="ml-1 text-xs opacity-70">({trip.fromWarehouse.code})</span>
              </span>
            )}
          </div>

          {trip.note && (
            <div className="truncate text-xs text-muted max-w-[18rem]">{trip.note}</div>
          )}
        </div>

        {/* Compteurs + heure */}
        <div className="shrink-0 space-y-1.5 text-right">
          <div className="flex items-center justify-end gap-3 text-sm">
            <span title="Arrêts" className="flex items-center gap-1 text-muted">
              <Route className="h-3.5 w-3.5" />
              <span className="tabular-nums font-semibold text-foreground">{stops}</span>
            </span>
            <span title="Bons de livraison" className="flex items-center gap-1 text-muted">
              <Package className="h-3.5 w-3.5" />
              <span className="tabular-nums font-semibold text-foreground">{deliveries}</span>
            </span>
          </div>
          <div className="flex items-center justify-end gap-1 text-xs text-muted">
            <Clock className="h-3 w-3" />
            <span>
              {isToday(refDate)
                ? `Aujourd'hui${fmtTime(refDate) ? ` ${fmtTime(refDate)}` : ""}`
                : fmtDateShort(refDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section pliable ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  accentCls,
  defaultOpen = true,
  children,
  emptyLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  accentCls: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Icon className={`h-4 w-4 shrink-0 ${accentCls}`} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-xs tabular-nums text-muted">
          {count}
        </span>
        <span className="ml-auto text-muted">
          {open
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        count === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {children}
          </div>
        )
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedBL[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [q, setQ] = useState("");

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [tripsRes, blRes] = await Promise.all([
        // Côté API : si le token est rôle DRIVER → renvoie uniquement ses tournées
        // Si ADMIN / MANAGER → renvoie tout. La page ne change pas côté client.
        apiGet<{ items: TripRow[] }>("/delivery-trips?limit=200"),
        // BLs créés depuis les ventes mais pas encore affectés à une tournée
        apiGet<{ items: UnassignedBL[] }>("/deliveries?tripId=none&limit=50"),
      ]);
      setTrips(tripsRes.items ?? []);
      setUnassigned(blRes.items ?? []);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Filtrage texte ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return trips;
    return trips.filter(
      (t) =>
        t.number.toLowerCase().includes(s) ||
        (t.driver?.name ?? "").toLowerCase().includes(s) ||
        (t.fromWarehouse?.name ?? "").toLowerCase().includes(s) ||
        (t.note ?? "").toLowerCase().includes(s)
    );
  }, [trips, q]);

  // ─── Groupes ────────────────────────────────────────────────────────────────

  const groups = useMemo(() => {
    const inProgress: TripRow[] = [];
    const loaded: TripRow[] = [];
    const draft: TripRow[] = [];
    const planned: TripRow[] = [];
    const history: TripRow[] = [];

    for (const t of filtered) {
      if (t.status === "IN_PROGRESS") { inProgress.push(t); continue; }
      if (t.status === "LOADED")      { loaded.push(t); continue; }
      if (t.status === "DRAFT") {
        isFuture(t.departureDate ?? t.createdAt) ? planned.push(t) : draft.push(t);
        continue;
      }
      history.push(t);
    }

    const byDate = (a: TripRow, b: TripRow) =>
      new Date(b.departureDate ?? b.createdAt).getTime() -
      new Date(a.departureDate ?? a.createdAt).getTime();

    return {
      inProgress: inProgress.sort(byDate),
      loaded:     loaded.sort(byDate),
      draft:      draft.sort(byDate),
      planned:    planned.sort(byDate),
      history:    history.sort(byDate),
    };
  }, [filtered]);

  const totalActive =
    groups.inProgress.length +
    groups.loaded.length +
    groups.draft.length +
    groups.planned.length;

  const visibleHistory = historyExpanded
    ? groups.history
    : groups.history.slice(0, 6);

  return (
    <div className="space-y-5">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Tournées</h1>
            <p className="text-sm text-muted">
              {loading
                ? "Chargement…"
                : totalActive > 0
                  ? `${totalActive} tournée${totalActive > 1 ? "s" : ""} active${totalActive > 1 ? "s" : ""}`
                  : "Planification et suivi des tournées."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/deliveries"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            Suivi livraisons
          </Link>
          <Link
            href="/app/trips/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nouvelle tournée
          </Link>
        </div>
      </div>

      {/* ── Bandeau BL sans tournée ──────────────────────────────────────────── */}
      {!loading && unassigned.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 ring-1 ring-primary/15">
          <div className="flex items-start gap-3">
            <span className="relative mt-0.5 flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {unassigned.length} bon{unassigned.length > 1 ? "s" : ""} de livraison{" "}
                {unassigned.length > 1 ? "attendent" : "attend"} une tournée
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {unassigned.slice(0, 4).map((bl) => (
                  <span key={bl.id} className="mr-3">
                    {bl.number}{(bl.sale?.client?.name ?? bl.order?.client?.name) ? ` · ${bl.sale?.client?.name ?? bl.order?.client?.name}` : ""}
                  </span>
                ))}
                {unassigned.length > 4 && `+${unassigned.length - 4} autres`}
              </p>
            </div>
          </div>
          <Link
            href="/app/deliveries?tripId=none"
            className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            Affecter →
          </Link>
        </div>
      )}

      {/* ── Erreur ──────────────────────────────────────────────────────────── */}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* ── Recherche + rafraîchir ───────────────────────────────────────────── */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Numéro, livreur, entrepôt…"
          className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
        />
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] disabled:opacity-50"
        >
          Rafraîchir
        </button>
      </div>

      {/* ── Sections ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted">Chargement…</div>
      ) : (
        <div className="space-y-6">

          {/* En cours */}
          <Section
            icon={Truck}
            title="En cours"
            count={groups.inProgress.length}
            accentCls="text-primary"
            defaultOpen
            emptyLabel="Aucune tournée en cours."
          >
            {groups.inProgress.map((t) => <TripCard key={t.id} trip={t} />)}
          </Section>

          {/* Chargées */}
          <Section
            icon={Package}
            title="Chargées — prêtes à partir"
            count={groups.loaded.length}
            accentCls="text-amber-600 dark:text-amber-400"
            defaultOpen
            emptyLabel="Aucune tournée chargée."
          >
            {groups.loaded.map((t) => <TripCard key={t.id} trip={t} />)}
          </Section>

          {/* En préparation */}
          <Section
            icon={Clock}
            title="En préparation"
            count={groups.draft.length}
            accentCls="text-muted"
            defaultOpen
            emptyLabel="Aucune tournée en préparation."
          >
            {groups.draft.map((t) => <TripCard key={t.id} trip={t} />)}
          </Section>

          {/* Planifiées (dates futures) */}
          {groups.planned.length > 0 && (
            <Section
              icon={Route}
              title="Planifiées"
              count={groups.planned.length}
              accentCls="text-muted"
              defaultOpen={false}
              emptyLabel="Aucune tournée planifiée."
            >
              {groups.planned.map((t) => <TripCard key={t.id} trip={t} />)}
            </Section>
          )}

          {/* Historique */}
          {groups.history.length > 0 && (
            <Section
              icon={CheckCircle2}
              title="Historique"
              count={groups.history.length}
              accentCls="text-emerald-600 dark:text-emerald-400"
              defaultOpen={false}
              emptyLabel="Aucun historique."
            >
              {visibleHistory.map((t) => <TripCard key={t.id} trip={t} />)}
              {!historyExpanded && groups.history.length > 6 && (
                <button
                  type="button"
                  onClick={() => setHistoryExpanded(true)}
                  className="col-span-full rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:text-foreground"
                >
                  Voir {groups.history.length - 6} tournée{groups.history.length - 6 > 1 ? "s" : ""} de plus
                </button>
              )}
            </Section>
          )}

          {/* État vide global */}
          {totalActive === 0 && groups.history.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <Route className="mx-auto h-8 w-8 text-muted opacity-40" />
              <p className="mt-3 text-sm font-medium text-foreground">Aucune tournée</p>
              <p className="mt-1 text-xs text-muted">
                Créez votre première tournée pour commencer.
              </p>
              <Link
                href="/app/trips/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Nouvelle tournée
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}