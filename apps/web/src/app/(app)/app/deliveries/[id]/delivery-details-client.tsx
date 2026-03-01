"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { ChevronRight, Copy, ExternalLink } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DeliveryStatus =
  | "DRAFT" | "PREPARED" | "OUT_FOR_DELIVERY"
  | "PARTIALLY_DELIVERED" | "DELIVERED" | "FAILED" | "CANCELLED";

type DeliveryEvent = {
  id: string; type: string;
  status?: DeliveryStatus | null;
  message?: string | null;
  meta?: string | null;
  createdAt: string;
};

type DeliveryLine = {
  id: string; qtyDelivered: number; note?: string | null;
  // Livraison depuis une vente
  saleLine?: {
    id: string; qty: number; qtyDelivered: number;
    product: { id: string; sku: string; name: string; unit: string };
  } | null;
  // Livraison depuis une commande B2B
  orderLine?: {
    id: string; qty: number; qtyDelivered?: number;
    product: { id: string; sku: string; name: string; unit: string };
  } | null;
};

type Delivery = {
  id: string; number: string; status: DeliveryStatus;
  note?: string | null; saleId?: string | null; orderId?: string | null;
  warehouseId: string; driverId?: string | null;
  trackingToken?: string | null;
  preparedAt?: string | null; dispatchedAt?: string | null; deliveredAt?: string | null;
  receiverName?: string | null; receiverPhone?: string | null; proofNote?: string | null;
  createdAt: string; updatedAt: string;
  sale?: {
    id: string; number: string;
    status: "DRAFT" | "POSTED" | "CANCELLED";
    client?: { id: string; name: string } | null;
    warehouse?: { id: string; code: string; name: string } | null;
    lines: Array<{
      id: string; qty: number; qtyDelivered: number;
      product: { id: string; sku: string; name: string; unit: string };
    }>;
  } | null;
  order?: {
    id: string; number: string;
    status: string;
    client?: { id: string; name: string } | null;
    warehouse?: { id: string; code: string; name: string } | null;
  } | null;
  warehouse: { id: string; code: string; name: string };
  driver?: { id: string; name: string; phone?: string | null } | null;
  trip?: { id: string; number: string; status?: string } | null;
  stop?: {
    id: string; sequence: number; status: string;
    client?: { id: string; name: string } | null;
    store?: { id: string; code: string; name: string } | null;
    contactNameSnapshot?: string | null;
    addressSnapshot?: string | null;
  } | null;
  lines: DeliveryLine[];
  items?: Array<{
    id: string; qty: number; note?: string | null;
    product: { id: string; sku: string; name: string; unit: string };
  }>;
  events: DeliveryEvent[];
};

type TripRow = { id: string; number: string; status: string };
type TripStopRow = {
  id: string; sequence: number; status: string;
  client?: { id: string; name: string } | null;
  store?: { id: string; code: string; name: string } | null;
  contactNameSnapshot?: string | null;
  addressSnapshot?: string | null;
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch { return dt; }
}

function stopLabel(stop: {
  client?: { name: string } | null;
  store?: { name: string } | null;
  contactNameSnapshot?: string | null;
  addressSnapshot?: string | null;
}) {
  return stop.client?.name || stop.store?.name || stop.contactNameSnapshot || stop.addressSnapshot || "Arrêt";
}

// ─── Labels & styles ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  DRAFT:               "Brouillon",
  PREPARED:            "Préparé",
  OUT_FOR_DELIVERY:    "En livraison",
  PARTIALLY_DELIVERED: "Livré partiellement",
  DELIVERED:           "Livré",
  FAILED:              "Échec",
  CANCELLED:           "Annulé",
};

const STATUS_CLS: Record<DeliveryStatus, string> = {
  DRAFT:               "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  PREPARED:            "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300",
  OUT_FOR_DELIVERY:    "border-primary/30 bg-primary/5 text-primary dark:text-orange-300",
  PARTIALLY_DELIVERED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  DELIVERED:           "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  FAILED:              "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  CANCELLED:           "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
};

const STOP_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente", VISITED: "Visité", PARTIAL: "Partiel",
  DONE: "Livré", FAILED: "Échec", CANCELLED: "Annulé",
};

const STOP_CLS: Record<string, string> = {
  PENDING:   "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400",
  VISITED:   "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  PARTIAL:   "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  DONE:      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  FAILED:    "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400",
};

function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[status]}`}>
      {STATUS_LABELS[status]}
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

// ─── Config actions / événements ──────────────────────────────────────────────

const STATUS_ACTIONS: Array<{ value: DeliveryStatus; label: string; description: string }> = [
  { value: "PREPARED",            label: "Préparé",             description: "Le BL est prêt à partir" },
  { value: "OUT_FOR_DELIVERY",    label: "En livraison",        description: "Le livreur est en route" },
  { value: "PARTIALLY_DELIVERED", label: "Livré partiellement", description: "Une partie a été livrée" },
  { value: "DELIVERED",           label: "Livré",               description: "Livraison complète confirmée" },
  { value: "FAILED",              label: "Échec",               description: "La livraison a échoué" },
  { value: "CANCELLED",           label: "Annuler le BL",       description: "Annulation définitive" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "NOTE",        label: "Note" },
  { value: "CALL",        label: "Appel téléphonique" },
  { value: "ISSUE",       label: "Incident" },
  { value: "ATTEMPT",     label: "Tentative de livraison" },
  { value: "RESCHEDULED", label: "Reprogrammé" },
  { value: "RETURNED",    label: "Retour entrepôt" },
  { value: "CUSTOM",      label: "Autre (personnalisé)" },
];

function getDefaultNextStatus(current: DeliveryStatus): DeliveryStatus {
  switch (current) {
    case "DRAFT":
    case "PREPARED":           return "OUT_FOR_DELIVERY";
    case "OUT_FOR_DELIVERY":
    case "PARTIALLY_DELIVERED": return "DELIVERED";
    default:                   return "OUT_FOR_DELIVERY";
  }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DeliveryDetailsClient({ id }: { id: string }) {
  const [item, setItem]         = useState<Delivery | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [statusNext, setStatusNext]       = useState<DeliveryStatus>("OUT_FOR_DELIVERY");
  const [statusMessage, setStatusMessage] = useState("");

  const [eventTypeKey, setEventTypeKey]       = useState("NOTE");
  const [eventTypeCustom, setEventTypeCustom] = useState("");
  const [eventMessage, setEventMessage]       = useState("");

  // Assignation tournée / arrêt
  const [assignOpen, setAssignOpen]               = useState(false);
  const [assignTrips, setAssignTrips]             = useState<TripRow[]>([]);
  const [assignTripsLoading, setAssignTripsLoading] = useState(false);
  const [assignTripId, setAssignTripId]           = useState("");
  const [assignStops, setAssignStops]             = useState<TripStopRow[]>([]);
  const [assignStopsLoading, setAssignStopsLoading] = useState(false);
  const [assignStopId, setAssignStopId]           = useState("");
  const [assignSaving, setAssignSaving]           = useState(false);
  const [assignErr, setAssignErr]                 = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const trackingUrl = useMemo(() => {
    if (!item?.trackingToken) return null;
    return `/track/${item.trackingToken}`;
  }, [item?.trackingToken]);

  // ── Chargement ────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ item: Delivery }>(`/deliveries/${id}`);
      setItem(res.item);
      setStatusNext(getDefaultNextStatus(res.item.status));
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Erreur lors du chargement.");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // ── Assignation ───────────────────────────────────────────────────────────

  async function loadTripsForAssign() {
    setAssignTripsLoading(true); setAssignErr(null);
    try {
      const res = await apiGet<{ items: TripRow[] }>("/delivery-trips?limit=200");
      setAssignTrips(res.items ?? []);
    } catch (e: unknown) {
      setAssignErr(e instanceof ApiError ? e.message : "Erreur chargement tournées");
    } finally {
      setAssignTripsLoading(false);
    }
  }

  async function loadStopsForTrip(tripId: string) {
    if (!tripId) { setAssignStops([]); return; }
    setAssignStopsLoading(true); setAssignErr(null);
    try {
      const res = await apiGet<{ item: { stops: TripStopRow[] } }>(`/delivery-trips/${tripId}`);
      setAssignStops(res.item?.stops ?? []);
    } catch (e: unknown) {
      setAssignErr(e instanceof ApiError ? e.message : "Erreur chargement arrêts");
    } finally {
      setAssignStopsLoading(false);
    }
  }

  async function openAssign() {
    if (!item) return;
    setAssignOpen(true); setAssignErr(null);
    setAssignTripId(item.trip?.id ?? "");
    setAssignStopId(item.stop?.id ?? "");
    await loadTripsForAssign();
    if (item.trip?.id) await loadStopsForTrip(item.trip.id);
  }

  async function submitAssign() {
    if (!item) return;
    const tripId = assignTripId.trim();
    const stopId = assignStopId.trim();
    if (!tripId && !stopId) { setAssignErr("Choisis une tournée."); return; }
    setAssignSaving(true); setAssignErr(null);
    try {
      const res = await apiPost<{ item: Delivery }>(`/deliveries/${item.id}/assign`, {
        tripId: tripId || null, stopId: stopId || null,
      });
      setItem(res.item);
      setAssignOpen(false);
      setAssignTripId(""); setAssignStopId(""); setAssignStops([]);
    } catch (e: unknown) {
      setAssignErr(e instanceof ApiError ? e.message : "Erreur assignation");
    } finally {
      setAssignSaving(false);
    }
  }

  // ── Statut ────────────────────────────────────────────────────────────────

  async function onSetStatus() {
    if (!item) return;
    setSaving(true); setErr(null); setSuccessMsg(null);
    try {
      const res = await apiPatch<{ item: Delivery }>(`/deliveries/${item.id}/status`, {
        status: statusNext,
        message: statusMessage.trim() || null,
      });
      setItem(res.item);
      setStatusMessage("");
      setStatusNext(getDefaultNextStatus(res.item.status));
      setSuccessMsg(`Statut mis à jour : ${STATUS_LABELS[res.item.status]}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setErr(e.code === "INSUFFICIENT_STOCK" ? "Stock insuffisant." : e.message);
      } else {
        setErr("Erreur lors du changement de statut.");
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Événement ─────────────────────────────────────────────────────────────

  async function onAddEvent() {
    if (!item) return;
    const finalType = eventTypeKey === "CUSTOM" ? eventTypeCustom.trim() : eventTypeKey;
    if (!finalType) { setErr("Le type d'événement est requis."); return; }
    setSaving(true); setErr(null);
    try {
      const res = await apiPost<{ item: Delivery }>(`/deliveries/${item.id}/events`, {
        type: finalType,
        message: eventMessage.trim() || null,
      });
      setItem(res.item);
      setEventMessage(""); setEventTypeKey("NOTE"); setEventTypeCustom("");
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Erreur lors de l'ajout de l'événement.");
    } finally {
      setSaving(false);
    }
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  async function copyTracking() {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = trackingUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  // ── États de chargement / erreur ──────────────────────────────────────────

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Chargement…</div>;
  }

  if (!item) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        Bon de livraison introuvable.
        {err && <div className="mt-2 text-xs opacity-90">{err}</div>}
      </div>
    );
  }

  const isFinal   = item.status === "DELIVERED" || item.status === "CANCELLED";
  const isInternal = !item.sale && !item.order;
  const clientLabel = item.sale
    ? (item.sale.client?.name ?? "Comptoir")
    : item.order
    ? (item.order.client?.name ?? "—")
    : "Réassort interne";
  const warehouseLabel = `${item.warehouse?.name ?? "—"} (${item.warehouse?.code ?? "—"})`;

  return (
    <div className="space-y-5">

      {/* ── Fil d'Ariane ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/deliveries" className="hover:text-foreground hover:underline underline-offset-4">
          Bons de livraison
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{item.number}</span>
      </div>

      {/* ── Carte principale ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-foreground text-lg">{item.number}</span>
              <StatusBadge status={item.status} />
              {isInternal && (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Réassort
                </span>
              )}
            </div>

            <div className="text-sm text-muted">
              {item.sale ? (
                <>
                  Vente :{" "}
                  <Link href={`/app/sales/${item.sale.id}`}
                    className="font-medium text-foreground underline underline-offset-4 hover:opacity-80">
                    {item.sale.number}
                  </Link>
                  {" "}· Client : <span className="font-medium text-foreground">{clientLabel}</span>
                  {" "}· {warehouseLabel}
                </>
              ) : item.order ? (
                <>
                  Commande :{" "}
                  <Link href={`/app/orders/${item.order.id}`}
                    className="font-medium text-foreground underline underline-offset-4 hover:opacity-80">
                    {item.order.number}
                  </Link>
                  {" "}· Client : <span className="font-medium text-foreground">{clientLabel}</span>
                  {" "}· {warehouseLabel}
                </>
              ) : (
                <>{warehouseLabel}</>
              )}
            </div>

            {/* Tournée · Arrêt — ✅ statut arrêt traduit, lien stops/ supprimé */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Tournée :</span>
              {item.trip ? (
                <Link href={`/app/trips/${item.trip.id}`}
                  className="font-medium text-foreground underline underline-offset-4 hover:opacity-80">
                  {item.trip.number}
                </Link>
              ) : <span>—</span>}

              {item.stop && (
                <>
                  <span>· Arrêt</span>
                  <span className="font-medium text-foreground">#{item.stop.sequence}</span>
                  <StopBadge status={item.stop.status} />
                  <span className="text-muted">{stopLabel(item.stop)}</span>
                </>
              )}

              <button type="button" onClick={openAssign}
                className="ml-1 underline underline-offset-4 hover:text-foreground">
                Réaffecter
              </button>
            </div>

            <div className="text-xs text-muted">
              Créé : {fmtDate(item.createdAt)} · Modifié : {fmtDate(item.updatedAt)}
            </div>
          </div>

          {/* Actions header */}
          <div className="flex flex-wrap items-center gap-2">
            {trackingUrl && (
              <>
                <button type="button" onClick={copyTracking}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copié !" : "Copier lien suivi"}
                </button>
                <a href={trackingUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Voir suivi
                </a>
              </>
            )}

            {item.trip && (
              <Link href={`/app/trips/${item.trip.id}`}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
                Voir la tournée →
              </Link>
            )}

            <button type="button" onClick={load}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted hover:text-foreground">
              Rafraîchir
            </button>
          </div>
        </div>

        {/* Note */}
        {item.note && (
          <div className="mx-4 mt-3 rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2 text-sm text-foreground">
            <span className="text-xs font-medium text-muted">Note : </span>{item.note}
          </div>
        )}

        {/* Timeline dates */}
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            { label: "Préparé",          value: item.preparedAt },
            { label: "Départ livraison", value: item.dispatchedAt },
            { label: "Livré",            value: item.deliveredAt },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2.5">
              <div className="text-xs text-muted">{label}</div>
              <div className={`mt-0.5 text-sm font-medium ${value ? "text-foreground" : "text-muted"}`}>
                {fmtDate(value)}
              </div>
            </div>
          ))}
        </div>

        {/* Livreur / Récepteur / Preuve */}
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2.5">
            <div className="text-xs text-muted">Livreur</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {item.driver?.name ?? <span className="font-normal text-muted">—</span>}
              {item.driver?.phone && <span className="ml-2 text-xs text-muted">({item.driver.phone})</span>}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2.5">
            <div className="text-xs text-muted">Récepteur</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {item.receiverName ?? <span className="font-normal text-muted">—</span>}
              {item.receiverPhone && <span className="ml-2 text-xs text-muted">({item.receiverPhone})</span>}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2.5">
            <div className="text-xs text-muted">Preuve / Note</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {item.proofNote ?? <span className="font-normal text-muted">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Assignation tournée / arrêt ───────────────────────────────────────── */}
      {assignOpen && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/60 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Affecter à une tournée</div>
              <div className="mt-0.5 text-xs text-muted">
                BL <span className="font-medium">{item.number}</span> · {item.sale?.number ?? "Interne"}
              </div>
            </div>
            <button type="button"
              onClick={() => { setAssignOpen(false); setAssignErr(null); }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted hover:text-foreground">
              Fermer
            </button>
          </div>

          {assignErr && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {assignErr}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">Tournée</label>
              <select
                value={assignTripId}
                onChange={async (e) => {
                  const v = e.target.value;
                  setAssignTripId(v); setAssignStopId("");
                  await loadStopsForTrip(v);
                }}
                className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
              >
                <option value="">—</option>
                {assignTrips.map((t) => (
                  <option key={t.id} value={t.id}>{t.number} · {t.status}</option>
                ))}
              </select>
              {assignTripsLoading && <div className="mt-1 text-xs text-muted">Chargement…</div>}
            </div>

            <div>
              <label className="text-xs text-muted">Arrêt (optionnel)</label>
              <select
                value={assignStopId}
                onChange={(e) => setAssignStopId(e.target.value)}
                disabled={!assignTripId}
                className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring disabled:opacity-50"
              >
                <option value="">—</option>
                {assignStops.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.sequence} · {STOP_STATUS_LABELS[s.status] ?? s.status} · {stopLabel(s)}
                  </option>
                ))}
              </select>
              {assignStopsLoading && <div className="mt-1 text-xs text-muted">Chargement…</div>}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={submitAssign} disabled={assignSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {assignSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Changer le statut ─────────────────────────────────────────────────── */}
      {!isFinal ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/60 space-y-3">
          <div className="text-sm font-semibold text-foreground">Changer le statut</div>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="min-w-[220px]">
              <label className="text-xs text-muted">Nouveau statut</label>
              <select
                value={statusNext}
                onChange={(e) => setStatusNext(e.target.value as DeliveryStatus)}
                className="mt-1 w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
              >
                {STATUS_ACTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <div className="mt-1 text-xs text-muted">
                {STATUS_ACTIONS.find((s) => s.value === statusNext)?.description}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted">Message (optionnel)</label>
              <input
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder='Ex : "Client absent", "Livraison partielle acceptée"…'
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {successMsg && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">{successMsg}</span>
            )}
            <button type="button" onClick={onSetStatus} disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? "Mise à jour…" : "Appliquer"}
            </button>
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {err}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-4 py-3 text-sm text-muted">
          Ce bon de livraison est dans un statut final (
          <span className="font-medium text-foreground">{STATUS_LABELS[item.status]}</span>
          ) — aucune modification possible.
        </div>
      )}

      {/* ── Lignes ───────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">
        <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
          <div className="text-sm font-semibold text-foreground">Lignes</div>
          <div className="text-xs text-muted">
            {item.sale
              ? "Livraison vente — quantités cumulées"
              : item.order
              ? "Livraison commande B2B"
              : "Livraison interne"}
          </div>
        </div>

        {item.lines.length === 0 && (!item.items || item.items.length === 0) ? (
          <div className="p-6 text-center text-sm text-muted">Aucune ligne.</div>

        ) : item.lines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Commandé</th>
                  <th className="px-4 py-3 text-right">Total livré</th>
                  <th className="px-4 py-3 text-right">Ce BL</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {item.lines.map((l) => {
                  // Résout la ligne source : vente ou commande B2B
                  const ref = l.saleLine ?? l.orderLine ?? null;
                  if (!ref) return null;
                  const totalDelivered = ref.qtyDelivered ?? 0;
                  const remaining = ref.qty - totalDelivered;
                  return (
                    <tr key={l.id} className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{ref.product.name}</div>
                        <div className="text-xs text-muted">{ref.product.sku} · {ref.product.unit}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{ref.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {totalDelivered}
                        {remaining > 0 && (
                          <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">({remaining} restant)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{l.qtyDelivered}</td>
                      <td className="px-4 py-3 text-muted">{l.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Quantité</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {(item.items ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.product.name}</div>
                      <div className="text-xs text-muted">{l.product.sku} · {l.product.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{l.qty}</td>
                    <td className="px-4 py-3 text-muted">{l.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Événements ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">
        <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
          <div className="text-sm font-semibold text-foreground">Événements</div>
          <div className="text-xs text-muted">
            {item.events.length} entrée{item.events.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Formulaire ajout événement */}
        <div className="border-b border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr]">
            <div>
              <label className="text-xs text-muted">Type</label>
              <select
                value={eventTypeKey}
                onChange={(e) => setEventTypeKey(e.target.value)}
                className="mt-1 appearance-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring"
              >
                {EVENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {eventTypeKey === "CUSTOM" && (
              <div>
                <label className="text-xs text-muted">Type personnalisé</label>
                <input
                  value={eventTypeCustom}
                  onChange={(e) => setEventTypeCustom(e.target.value)}
                  placeholder="Ex : SMS, RELIVERY…"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted">Message</label>
              <input
                value={eventMessage}
                onChange={(e) => setEventMessage(e.target.value)}
                placeholder="Ex : Client absent, rappel programmé demain matin…"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={onAddEvent}
              disabled={saving || (eventTypeKey === "CUSTOM" && !eventTypeCustom.trim())}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] disabled:cursor-not-allowed disabled:opacity-50">
              Ajouter un événement
            </button>
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {err}
            </div>
          )}
        </div>

        {/* Liste des événements */}
        {item.events.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted">Aucun événement enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {item.events.map((e) => {
                  const typeOption = EVENT_TYPE_OPTIONS.find((o) => o.value === e.type);
                  return (
                    <tr key={e.id} className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{fmtDate(e.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{typeOption?.label ?? e.type}</td>
                      <td className="px-4 py-3">
                        {e.status ? <StatusBadge status={e.status} /> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted">{e.message ?? "—"}</td>
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