"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import {
  Truck, Package, Route, CheckCircle2, AlertCircle,
  Plus, ChevronRight, MapPin, CreditCard, Banknote,
  Smartphone, X, Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TripStatus     = "DRAFT" | "LOADED" | "IN_PROGRESS" | "DONE" | "CLOSED" | "CANCELLED";
type StopStatus     = "PENDING" | "VISITED" | "PARTIAL" | "DONE" | "FAILED" | "CANCELLED";
type DeliveryStatus = "DRAFT" | "PREPARED" | "OUT_FOR_DELIVERY" | "PARTIALLY_DELIVERED" | "DELIVERED" | "FAILED" | "CANCELLED";

type Driver    = { id: string; name: string; phone?: string | null };
type Warehouse = { id: string; code: string; name: string };

type StopDelivery = {
  id: string; number: string; status: DeliveryStatus;
  sale?:  { id: string; number: string; totalTTC: number; client?: { id: string; name: string } | null } | null;
  order?: { id: string; number: string; client?: { id: string; name: string } | null } | null;
};

type Stop = {
  id: string; sequence: number; status: StopStatus;
  note?: string | null; clientName?: string | null; address?: string | null;
  amountCollected?: number | null; paymentMode?: string | null;
  deliveries?: StopDelivery[];
};

type Trip = {
  id: string; number: string; status: TripStatus;
  note?: string | null; departureDate?: string | null;
  createdAt: string; updatedAt: string;
  fromWarehouse?: Warehouse | null; driver?: Driver | null;
  stops?: Stop[];
};

type UnassignedBL = {
  id: string; number: string; status: DeliveryStatus;
  sale?:  { id: string; number: string; totalTTC: number; client?: { id: string; name: string } | null } | null;
  order?: { id: string; number: string; client?: { id: string; name: string } | null } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}
function fmtXOF(n: number | null | undefined) {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n ?? 0); }
  catch { return String(n ?? 0); }
}
function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt)); }
  catch { return dt; }
}

// ─── Labels & styles ─────────────────────────────────────────────────────────

const TRIP_LABELS: Record<TripStatus, string> = {
  DRAFT: "En préparation", LOADED: "Chargée", IN_PROGRESS: "En cours",
  DONE: "Terminée", CLOSED: "Clôturée", CANCELLED: "Annulée",
};

const STOP_LABELS: Record<StopStatus, string> = {
  PENDING: "En attente", VISITED: "Visité", PARTIAL: "Partiel",
  DONE: "Livré", FAILED: "Échec", CANCELLED: "Annulé",
};

const STOP_CLS: Record<StopStatus, string> = {
  PENDING:   "border-border text-muted",
  VISITED:   "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  PARTIAL:   "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  DONE:      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  FAILED:    "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  CANCELLED: "border-border text-muted bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]",
};

const DELIVERY_CLS: Record<DeliveryStatus, string> = {
  DRAFT:               "border-border text-muted",
  PREPARED:            "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300",
  OUT_FOR_DELIVERY:    "border-primary/30 bg-primary/5 text-primary",
  PARTIALLY_DELIVERED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  DELIVERED:           "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  FAILED:              "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  CANCELLED:           "border-border text-muted bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]",
};

const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  DRAFT: "Brouillon", PREPARED: "Préparé", OUT_FOR_DELIVERY: "En livraison",
  PARTIALLY_DELIVERED: "Partiel", DELIVERED: "Livré", FAILED: "Échec", CANCELLED: "Annulé",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Espèces", MOBILE_MONEY: "Mobile money", CREDIT: "Crédit client",
};

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS: Array<{ keys: TripStatus[]; label: string }> = [
  { keys: ["DRAFT"],          label: "Préparation" },
  { keys: ["LOADED"],         label: "Chargée"     },
  { keys: ["IN_PROGRESS"],    label: "En route"    },
  { keys: ["DONE", "CLOSED"], label: "Terminée"    },
];

function Stepper({ status }: { status: TripStatus }) {
  if (status === "CANCELLED") return null;
  const cur = STEPS.findIndex((s) => s.keys.includes(status));
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done   = i < cur;
        const active = i === cur;
        return (
          <div key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                done   ? "bg-emerald-500 text-white"
                : active ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                : "border border-border bg-card text-muted"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`hidden text-[11px] sm:block ${active ? "font-semibold text-foreground" : "text-muted"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 mb-3 h-0.5 flex-1 ${i < cur ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bandeau action contextuel ────────────────────────────────────────────────

type BannerProps = {
  trip: Trip; busy: string | null;
  onTransition: (next: TripStatus, confirm?: string) => void;
};

function ActionBanner({ trip, busy, onTransition }: BannerProps) {
  const hasStops  = (trip.stops?.length ?? 0) > 0;
  const hasDriver = !!trip.driver;
  const allSettled = trip.stops?.every(
    (s) => ["DONE", "PARTIAL", "FAILED", "CANCELLED"].includes(s.status)
  ) ?? false;

  switch (trip.status) {

    case "DRAFT":
      return (
        <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
              <div>
                <div className="font-semibold text-foreground">En préparation</div>
                <div className="mt-0.5 text-sm text-muted">
                  {!hasDriver ? "Assignez un livreur, ajoutez les arrêts et les BLs avant de charger."
                  : !hasStops ? "Ajoutez au moins un arrêt avec ses bons de livraison."
                  : "Tournée prête à être chargée."}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <button type="button" disabled={!hasStops || !hasDriver || !!busy}
                onClick={() => onTransition("LOADED")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
                {busy === "LOADED" ? "…" : "Marquer comme chargée →"}
              </button>
              <button type="button" disabled={!!busy}
                onClick={() => onTransition("CANCELLED", "Confirmer l'annulation ?")}
                className="text-xs text-muted underline underline-offset-4 hover:text-red-600 disabled:opacity-50">
                Annuler la tournée
              </button>
            </div>
          </div>
        </div>
      );

    case "LOADED":
      return (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
              <div>
                <div className="font-semibold text-sky-900 dark:text-sky-200">Chargée — prête à partir</div>
                <div className="mt-0.5 text-sm text-sky-700 dark:text-sky-300">
                  Le livreur peut prendre la route.
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" disabled={!!busy}
                onClick={() => onTransition("DRAFT")}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:text-foreground disabled:opacity-50">
                Retour préparation
              </button>
              <button type="button" disabled={!!busy}
                onClick={() => onTransition("IN_PROGRESS")}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                {busy === "IN_PROGRESS" ? "…" : "Démarrer la tournée →"}
              </button>
            </div>
          </div>
        </div>
      );

    case "IN_PROGRESS":
      return (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5">
                <Truck className="h-5 w-5 text-primary" />
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
              </div>
              <div>
                <div className="font-semibold text-foreground">Tournée en cours</div>
                <div className="mt-0.5 text-sm text-muted">
                  {trip.driver?.name} est en route.
                  {!allSettled && ` Des arrêts sont encore en attente.`}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {/* Cockpit livreur — action principale */}
              <Link href={`/app/trips/${trip.id}/drive`}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
                <Truck className="h-4 w-4" /> Cockpit livreur
              </Link>
              <button type="button" disabled={!allSettled || !!busy}
                onClick={() => onTransition("DONE")}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                {busy === "DONE" ? "…" : "✓ Terminer la tournée"}
              </button>
            </div>
          </div>
        </div>
      );

    case "DONE":
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <div className="font-semibold text-emerald-900 dark:text-emerald-200">Tournée terminée</div>
                <div className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-300">
                  Vérifiez les encaissements puis clôturez.
                </div>
              </div>
            </div>
            <button type="button" disabled={!!busy}
              onClick={() => onTransition("CLOSED")}
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-transparent dark:text-emerald-300">
              {busy === "CLOSED" ? "…" : "Clôturer et archiver"}
            </button>
          </div>
        </div>
      );

    case "CLOSED":
      return (
        <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            Tournée clôturée — archivée.
          </div>
        </div>
      );

    case "CANCELLED":
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <X className="h-4 w-4 shrink-0" />
            Tournée annulée — aucune modification possible.
          </div>
        </div>
      );

    default: return null;
  }
}

// ─── Formulaire ajout arrêt (inline) ─────────────────────────────────────────

function AddStopForm({ onSave, onCancel }: {
  onSave: (clientName: string, address: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [address, setAddress]       = useState("");
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    if (!clientName.trim()) return;
    setSaving(true);
    await onSave(clientName.trim(), address.trim());
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="text-sm font-semibold text-foreground">Nouvel arrêt</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-muted mb-1">Client / Lieu <span className="text-red-500">*</span></label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom du client ou lieu…"
            autoFocus
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Adresse (optionnel)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Rue, ville…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleSave} disabled={saving || !clientName.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? "Ajout…" : "Ajouter l'arrêt"}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Carte arrêt ──────────────────────────────────────────────────────────────

function StopCard({ stop, tripId, tripStatus, onAssign }: {
  stop: Stop; tripId: string; tripStatus: TripStatus;
  onAssign: (stopId: string) => void;
}) {
  const isEditable   = tripStatus === "DRAFT" || tripStatus === "LOADED";
  const isInProgress = tripStatus === "IN_PROGRESS";
  const isSettled    = stop.status === "DONE" || stop.status === "PARTIAL";
  const totalDue     = (stop.deliveries ?? []).reduce((s, d) => s + (d.sale?.totalTTC ?? 0), 0);

  return (
    <div className={`rounded-xl border bg-card shadow-sm ${
      isInProgress && stop.status === "PENDING" ? "border-primary/30 ring-1 ring-primary/20" : "border-border"
    }`}>
      {/* Header arrêt */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            stop.status === "DONE"    ? "bg-emerald-500 text-white"
            : stop.status === "PARTIAL" ? "bg-amber-500 text-white"
            : stop.status === "FAILED"  ? "bg-red-500 text-white"
            : stop.status === "CANCELLED" ? "border border-border text-muted"
            : isInProgress ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-muted"
          }`}>
            {stop.status === "DONE" || stop.status === "PARTIAL" ? "✓" : stop.sequence}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{stop.clientName ?? `Arrêt ${stop.sequence}`}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STOP_CLS[stop.status]}`}>
                {STOP_LABELS[stop.status]}
              </span>
            </div>
            {stop.address && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3 w-3 shrink-0" />{stop.address}
              </div>
            )}
          </div>
        </div>

        {/* Bouton "Exécuter" — grand et visible sur mobile */}
        {isInProgress && stop.status === "PENDING" && (
          <Link href={`/app/trips/${tripId}/stops/${stop.id}`}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            Exécuter →
          </Link>
        )}
        {isInProgress && (stop.status === "VISITED") && (
          <Link href={`/app/trips/${tripId}/stops/${stop.id}`}
            className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            Continuer →
          </Link>
        )}
      </div>

      {/* BLs affectés */}
      <div className="divide-y divide-border">
        {(stop.deliveries ?? []).length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted">Aucun bon de livraison affecté.</div>
        ) : (
          (stop.deliveries ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/deliveries/${d.id}`}
                    className="text-sm font-medium text-foreground hover:underline underline-offset-4">
                    {d.number}
                  </Link>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${DELIVERY_CLS[d.status]}`}>
                    {DELIVERY_LABELS[d.status]}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  {d.sale?.client?.name ?? d.order?.client?.name ?? "—"}
                  {d.sale?.number && (
                    <> · <Link href={`/app/sales/${d.sale.id}`} className="hover:underline">{d.sale.number}</Link></>
                  )}
                  {d.order?.number && (
                    <> · <Link href={`/app/orders/${d.order.id}`} className="hover:underline">{d.order.number}</Link></>
                  )}
                </div>
              </div>
              {d.sale?.totalTTC != null && (
                <div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {fmtXOF(d.sale.totalTTC)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Affecter BL */}
      {isEditable && (
        <div className="border-t border-dashed border-border px-4 py-2">
          <button type="button" onClick={() => onAssign(stop.id)}
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted hover:text-primary">
            <Plus className="h-3.5 w-3.5" /> Affecter un bon de livraison
          </button>
        </div>
      )}

      {/* Encaissement */}
      {isSettled && (
        <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted">
            {stop.paymentMode === "MOBILE_MONEY" && <Smartphone className="h-3.5 w-3.5" />}
            {stop.paymentMode === "CASH"         && <Banknote   className="h-3.5 w-3.5" />}
            {stop.paymentMode === "CREDIT"       && <CreditCard className="h-3.5 w-3.5" />}
            {stop.paymentMode ? (PAYMENT_LABELS[stop.paymentMode] ?? stop.paymentMode) : "Paiement"}
          </div>
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {stop.amountCollected != null ? fmtXOF(stop.amountCollected) : "—"}
            {totalDue > 0 && stop.amountCollected != null && stop.amountCollected < totalDue && (
              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">
                ({fmtXOF(totalDue - stop.amountCollected)} restant)
              </span>
            )}
          </div>
        </div>
      )}

      {stop.note && (
        <div className="rounded-b-xl border-t border-border px-4 py-2 text-xs text-muted italic">{stop.note}</div>
      )}
    </div>
  );
}

// ─── Modal affectation BL ─────────────────────────────────────────────────────

function AssignBLModal({ stopId, onClose, onDone }: {
  stopId: string; onClose: () => void; onDone: () => void;
}) {
  const [items, setItems]   = useState<UnassignedBL[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState<string | null>(null);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ items: UnassignedBL[] }>("/deliveries?tripId=none&limit=100");
        setItems(res.items ?? []);
      } catch (e) { setErr(errMsg(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  async function assign(blId: string) {
    setBusy(blId); setErr(null);
    try {
      await apiPost(`/delivery-trips/stops/${stopId}/deliveries`, { deliveryIds: [blId] });
      onDone();
    } catch (e) { setErr(errMsg(e)); setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Affecter un bon de livraison</span>
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted hover:text-foreground">
            Fermer
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto p-3 space-y-2">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted">Chargement…</div>
          ) : err ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{err}</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">Aucun bon de livraison disponible.</div>
          ) : items.map((bl) => (
            <div key={bl.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{bl.number}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${DELIVERY_CLS[bl.status]}`}>
                    {DELIVERY_LABELS[bl.status]}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  {bl.sale?.client?.name ?? bl.order?.client?.name ?? "Sans client"}
                  {bl.sale?.totalTTC != null && <> · {fmtXOF(bl.sale.totalTTC)}</>}
                </div>
              </div>
              <button type="button" disabled={!!busy} onClick={() => assign(bl.id)}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {busy === bl.id ? "…" : "Affecter"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function TripDetailsClient({ id }: { id: string }) {
  const [trip, setTrip]         = useState<Trip | null>(null);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState<string | null>(null);
  const [err, setErr]           = useState<string | null>(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [assignModal, setAssignModal] = useState<{ stopId: string } | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ item: Trip }>(`/delivery-trips/${id}`);
      setTrip(res.item);
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function onTransition(next: TripStatus, confirm?: string) {
    if (!trip) return;
    if (confirm && !window.confirm(confirm)) return;
    setBusy(next); setErr(null);
    try {
      const res = await apiPatch<{ item: Trip }>(`/delivery-trips/${id}/status`, { status: next });
      setTrip(res.item);
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(null); }
  }

  async function onAddStop(clientName: string, address: string) {
    if (!trip) return;
    try {
      await apiPost(`/delivery-trips/${id}/stops`, {
        clientName, address: address || null,
        sequence: (trip.stops?.length ?? 0) + 1,
      });
      await load();
      setShowAddStop(false);
    } catch (e) { setErr(errMsg(e)); }
  }

  const recap = useMemo(() => {
    if (!trip?.stops) return { totalDue: 0, totalCollected: 0, stopsDone: 0, stopsTotal: 0, blCount: 0 };
    let totalDue = 0, totalCollected = 0, stopsDone = 0, blCount = 0;
    for (const s of trip.stops) {
      blCount += (s.deliveries?.length ?? 0);
      for (const d of s.deliveries ?? []) totalDue += d.sale?.totalTTC ?? 0;
      if (s.amountCollected != null) totalCollected += s.amountCollected;
      if (s.status === "DONE" || s.status === "PARTIAL") stopsDone++;
    }
    return { totalDue, totalCollected, stopsDone, stopsTotal: trip.stops.length, blCount };
  }, [trip]);

  if (loading) return <div className="py-16 text-center text-sm text-muted">Chargement…</div>;

  if (!trip) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Tournée introuvable."}
        </div>
        <Link href="/app/trips" className="inline-flex rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground">
          ← Retour aux tournées
        </Link>
      </div>
    );
  }

  const isEditable   = trip.status === "DRAFT" || trip.status === "LOADED";
  const isFinal      = trip.status === "CLOSED" || trip.status === "CANCELLED";

  return (
    <div className="space-y-4">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/trips" className="hover:text-foreground hover:underline underline-offset-4">Tournées</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{trip.number}</span>
      </div>

      {/* ── Bandeau action ────────────────────────────────────────────────────── */}
      <ActionBanner trip={trip} busy={busy} onTransition={onTransition} />

      {/* Erreur */}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* ── Carte infos tournée ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <Stepper status={trip.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 shrink-0 text-muted" />
            {trip.driver
              ? <><span className="font-medium text-foreground">{trip.driver.name}</span>{trip.driver.phone && <span className="text-xs text-muted">· {trip.driver.phone}</span>}</>
              : <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertCircle className="h-3.5 w-3.5" />Aucun livreur</span>}
          </div>
          {trip.fromWarehouse && (
            <div className="flex items-center gap-2 text-muted">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{trip.fromWarehouse.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted">
            <Clock className="h-4 w-4 shrink-0" />
            <span>Créée le {fmtDate(trip.createdAt)}</span>
            {trip.departureDate && <span>· Départ prévu {fmtDate(trip.departureDate)}</span>}
          </div>
          <Link href="/app/trips" className="ml-auto text-xs text-muted hover:underline underline-offset-4">
            ← Retour
          </Link>
        </div>
        {trip.note && (
          <div className="border-t border-border px-4 py-2 text-sm text-muted italic">{trip.note}</div>
        )}
      </div>

      {/* ── Récap chiffres ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Arrêts traités", value: `${recap.stopsDone} / ${recap.stopsTotal}`, Icon: Route },
          { label: "Bons de livraison", value: String(recap.blCount), Icon: Package },
          { label: "Total dû", value: fmtXOF(recap.totalDue), Icon: CreditCard },
          { label: "Encaissé", value: fmtXOF(recap.totalCollected), Icon: Banknote },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Icon className="h-3.5 w-3.5 shrink-0" />{label}
            </div>
            <div className="mt-1 text-base font-bold tabular-nums text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Arrêts ────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Arrêts
            <span className="ml-2 font-normal text-muted">
              {recap.stopsTotal} arrêt{recap.stopsTotal > 1 ? "s" : ""} · {recap.blCount} BL
            </span>
          </h2>
          {isEditable && !showAddStop && (
            <button type="button" onClick={() => setShowAddStop(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
              <Plus className="h-3.5 w-3.5" /> Ajouter un arrêt
            </button>
          )}
        </div>

        {/* Formulaire ajout arrêt inline */}
        {showAddStop && (
          <AddStopForm
            onSave={onAddStop}
            onCancel={() => setShowAddStop(false)}
          />
        )}

        {(trip.stops?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <MapPin className="mx-auto h-7 w-7 text-muted opacity-40" />
            <p className="mt-2 text-sm text-muted">Aucun arrêt planifié.</p>
            {isEditable && (
              <button type="button" onClick={() => setShowAddStop(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> Ajouter le premier arrêt
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(trip.stops ?? [])
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  tripId={id}
                  tripStatus={trip.status}
                  onAssign={(stopId) => setAssignModal({ stopId })}
                />
              ))}
          </div>
        )}
      </div>

      {/* Modal affectation BL */}
      {assignModal && (
        <AssignBLModal
          stopId={assignModal.stopId}
          onClose={() => setAssignModal(null)}
          onDone={async () => { setAssignModal(null); await load(); }}
        />
      )}

    </div>
  );
}