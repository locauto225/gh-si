"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import {
  ChevronLeft, ChevronRight, MapPin, Package,
  CheckCircle2, AlertCircle, Clock, Banknote,
  Smartphone, CreditCard, Plus, Minus, Truck,
  X, Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TripStatus = "DRAFT" | "LOADED" | "IN_PROGRESS" | "DONE" | "CLOSED" | "CANCELLED";
type StopStatus = "PENDING" | "VISITED" | "PARTIAL" | "DONE" | "FAILED" | "CANCELLED";
type DeliveryStatus = "DRAFT" | "PREPARED" | "OUT_FOR_DELIVERY" | "PARTIALLY_DELIVERED" | "DELIVERED" | "FAILED" | "CANCELLED";
type PaymentMode = "CASH" | "MOBILE_MONEY" | "CREDIT";

type DeliveryLine = {
  id: string;
  qtyDelivered: number;
  saleLine?: {
    id: string;
    qty: number;
    unitPrice: number;
    product?: { id: string; name: string; sku?: string | null; unit?: string | null } | null;
  } | null;
};

type StopDelivery = {
  id: string;
  number: string;
  status: DeliveryStatus;
  lines?: DeliveryLine[];
  sale?: {
    id: string;
    number: string;
    totalTTC: number;
    client?: { id: string; name: string } | null;
  } | null;
};

type Stop = {
  id: string;
  sequence: number;
  status: StopStatus;
  note?: string | null;
  clientName?: string | null;
  address?: string | null;
  amountCollected?: number | null;
  paymentMode?: string | null;
  deliveries?: StopDelivery[];
};

type Trip = {
  id: string;
  number: string;
  status: TripStatus;
  note?: string | null;
  fromWarehouse?: { id: string; code: string; name: string } | null;
  driver?: { id: string; name: string } | null;
  stops?: Stop[];
};

// ─── Saisie locale par arrêt ──────────────────────────────────────────────────

type PaymentEntry = {
  id: string; // uuid local
  mode: PaymentMode;
  amount: string; // string pour l'input
  provider: string; // "WAVE" | "ORANGE_MONEY" | "MTN" | ""
  reference: string;
};

type StopDraft = {
  // lineId → quantité livrée (saisie locale)
  qtys: Record<string, number>;
  payments: PaymentEntry[];
  outcome: "DONE" | "PARTIAL" | "FAILED" | null;
};

type DraftState = Record<string, StopDraft>; // stopId → draft

type DraftAction =
  | { type: "SET_QTY";      stopId: string; lineId: string; qty: number }
  | { type: "ADD_PAYMENT";  stopId: string }
  | { type: "SET_PAYMENT";  stopId: string; payId: string; field: keyof PaymentEntry; value: string }
  | { type: "DEL_PAYMENT";  stopId: string; payId: string }
  | { type: "SET_OUTCOME";  stopId: string; outcome: StopDraft["outcome"] }
  | { type: "INIT_STOP";    stopId: string; lines: DeliveryLine[] };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  const get = (id: string): StopDraft =>
    state[id] ?? { qtys: {}, payments: [], outcome: null };

  switch (action.type) {
    case "INIT_STOP": {
      if (state[action.stopId]) return state; // déjà initialisé
      const qtys: Record<string, number> = {};
      for (const l of action.lines) {
        qtys[l.id] = l.qtyDelivered ?? 0;
      }
      return { ...state, [action.stopId]: { qtys, payments: [{ id: uid(), mode: "CASH", amount: "", provider: "", reference: "" }], outcome: null } };
    }
    case "SET_QTY": {
      const d = get(action.stopId);
      return { ...state, [action.stopId]: { ...d, qtys: { ...d.qtys, [action.lineId]: Math.max(0, action.qty) } } };
    }
    case "ADD_PAYMENT": {
      const d = get(action.stopId);
      return { ...state, [action.stopId]: { ...d, payments: [...d.payments, { id: uid(), mode: "CASH", amount: "", provider: "", reference: "" }] } };
    }
    case "SET_PAYMENT": {
      const d = get(action.stopId);
      return {
        ...state,
        [action.stopId]: {
          ...d,
          payments: d.payments.map((p) =>
            p.id === action.payId ? { ...p, [action.field]: action.value } : p
          ),
        },
      };
    }
    case "DEL_PAYMENT": {
      const d = get(action.stopId);
      return { ...state, [action.stopId]: { ...d, payments: d.payments.filter((p) => p.id !== action.payId) } };
    }
    case "SET_OUTCOME": {
      const d = get(action.stopId);
      return { ...state, [action.stopId]: { ...d, outcome: action.outcome } };
    }
    default: return state;
  }
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

function fmtXOF(n: number | null | undefined): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n ?? 0);
  } catch { return String(n ?? 0); }
}

const STOP_ORDER: StopStatus[] = ["PENDING", "VISITED", "PARTIAL", "DONE", "FAILED", "CANCELLED"];

function isSettled(s: StopStatus) {
  return s === "DONE" || s === "PARTIAL" || s === "FAILED" || s === "CANCELLED";
}

// ─── Icône mode paiement ──────────────────────────────────────────────────────

function PayIcon({ mode }: { mode: PaymentMode }) {
  if (mode === "MOBILE_MONEY") return <Smartphone className="h-4 w-4" />;
  if (mode === "CREDIT")       return <CreditCard className="h-4 w-4" />;
  return <Banknote className="h-4 w-4" />;
}

// ─── Saisie paiement ──────────────────────────────────────────────────────────

function PaymentRow({
  entry,
  stopId,
  canDelete,
  dispatch,
}: {
  entry: PaymentEntry;
  stopId: string;
  canDelete: boolean;
  dispatch: React.Dispatch<DraftAction>;
}) {
  const set = (field: keyof PaymentEntry, value: string) =>
    dispatch({ type: "SET_PAYMENT", stopId, payId: entry.id, field, value });

  return (
    <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] p-3 space-y-2">
      {/* Mode */}
      <div className="flex items-center gap-2">
        <PayIcon mode={entry.mode} />
        <select
          value={entry.mode}
          onChange={(e) => set("mode", e.target.value)}
          className="flex-1 appearance-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring"
        >
          <option value="CASH">Espèces</option>
          <option value="MOBILE_MONEY">Mobile money</option>
          <option value="CREDIT">Crédit client</option>
        </select>
        {canDelete && (
          <button
            type="button"
            onClick={() => dispatch({ type: "DEL_PAYMENT", stopId, payId: entry.id })}
            className="rounded-lg border border-border bg-card p-2 text-muted hover:text-danger"
            aria-label="Supprimer ce paiement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Fournisseur si mobile money */}
      {entry.mode === "MOBILE_MONEY" && (
        <select
          value={entry.provider}
          onChange={(e) => set("provider", e.target.value)}
          className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring"
        >
          <option value="">Opérateur…</option>
          <option value="WAVE">Wave</option>
          <option value="ORANGE_MONEY">Orange Money</option>
          <option value="MTN">MTN MoMo</option>
        </select>
      )}

      {/* Montant */}
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={entry.amount}
        onChange={(e) => set("amount", e.target.value)}
        placeholder="Montant (FCFA)"
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-semibold tabular-nums text-foreground placeholder:font-normal placeholder:text-muted outline-none focus:ring"
      />

      {/* Référence si mobile money */}
      {entry.mode === "MOBILE_MONEY" && (
        <input
          type="text"
          value={entry.reference}
          onChange={(e) => set("reference", e.target.value)}
          placeholder="Référence transaction (optionnel)"
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
        />
      )}
    </div>
  );
}

// ─── Vue arrêt ────────────────────────────────────────────────────────────────

function StopView({
  stop,
  tripId,
  draft,
  dispatch,
  onValidated,
}: {
  stop: Stop;
  tripId: string;
  draft: StopDraft;
  dispatch: React.Dispatch<DraftAction>;
  onValidated: () => void;
}) {
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [ok, setOk]       = useState(false);

  // Toutes les lignes produit à travers les BLs
  const allLines = useMemo(() =>
    (stop.deliveries ?? []).flatMap((d) =>
      (d.lines ?? []).map((l) => ({ ...l, deliveryNumber: d.number }))
    ),
    [stop]
  );

  // Initialiser les qtys depuis les lignes existantes
  useEffect(() => {
    dispatch({ type: "INIT_STOP", stopId: stop.id, lines: allLines });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.id]);

  const totalDue = (stop.deliveries ?? []).reduce((s, d) => s + (d.sale?.totalTTC ?? 0), 0);
  const totalPaid = draft.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const balance   = totalDue - totalPaid;
  const allQtysOk = allLines.every((l) => (draft.qtys[l.id] ?? 0) >= (l.saleLine?.qty ?? 0));

  // Paiement requis si arrêt livré (DONE ou PARTIAL) avec montant dû > 0.
  // Exception : "Crédit client" est un paiement différé légitime (montant 0 accepté).
  const hasCredit = draft.payments.some((p) => p.mode === "CREDIT");
  const paymentRequired = totalDue > 0 && (draft.outcome === "DONE" || draft.outcome === "PARTIAL");
  const paymentOk = !paymentRequired || totalPaid > 0 || hasCredit;

  const canSubmit = !busy && draft.outcome !== null && paymentOk;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true); setErr(null);

    const payments = draft.payments
      .filter((p) => parseFloat(p.amount) > 0)
      .map((p) => ({
        mode: p.mode,
        amount: parseFloat(p.amount),
        provider: p.provider || undefined,
        reference: p.reference || undefined,
      }));

    const lineUpdates = allLines.map((l) => ({
      lineId: l.id,
      qtyDelivered: draft.qtys[l.id] ?? 0,
    }));

    try {
      await apiPatch(`/delivery-trips/${tripId}/stops/${stop.id}`, {
        status: draft.outcome,
        lineUpdates,
        payments,
        amountCollected: totalPaid || undefined,
        paymentMode: payments.length === 1 ? payments[0].mode : payments.length > 1 ? "MIXED" : undefined,
      });
      setOk(true);
      setTimeout(onValidated, 800);
    } catch (e) {
      setErr(errMessage(e));
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-base font-semibold text-foreground">Arrêt validé !</p>
      </div>
    );
  }

  const settled = isSettled(stop.status);

  return (
    <div className="flex flex-col gap-5 pb-32">

      {/* Infos arrêt */}
      <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm ring-1 ring-border/40">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <div className="text-base font-bold text-foreground">
              {stop.clientName ?? `Arrêt ${stop.sequence}`}
            </div>
            {stop.address && <div className="mt-0.5 text-sm text-muted">{stop.address}</div>}
            {stop.note   && <div className="mt-1 text-xs text-muted italic">{stop.note}</div>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Total dû</span>
          <span className="text-xl font-bold tabular-nums text-foreground">{fmtXOF(totalDue)}</span>
        </div>
      </div>

      {/* Lignes produits */}
      {allLines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted px-1">Produits</h3>
          {allLines.map((l) => {
            const ordered = l.saleLine?.qty ?? 0;
            const current = draft.qtys[l.id] ?? 0;
            const isComplete = current >= ordered;
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {l.saleLine?.product?.name ?? "—"}
                  </div>
                  <div className="text-xs text-muted">
                    {l.saleLine?.product?.sku ? `${l.saleLine.product.sku} · ` : ""}
                    Commandé : {ordered} {l.saleLine?.product?.unit ?? ""}
                  </div>
                </div>

                {/* Stepper quantité */}
                {!settled ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={current <= 0}
                      onClick={() => dispatch({ type: "SET_QTY", stopId: stop.id, lineId: l.id, qty: current - 1 })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-30"
                      aria-label="Diminuer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className={[
                      "w-10 text-center text-base font-bold tabular-nums",
                      isComplete ? "text-emerald-600 dark:text-emerald-400" : current > 0 ? "text-warning" : "text-muted",
                    ].join(" ")}>
                      {current}
                    </span>
                    <button
                      type="button"
                      disabled={current >= ordered}
                      onClick={() => dispatch({ type: "SET_QTY", stopId: stop.id, lineId: l.id, qty: current + 1 })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-30"
                      aria-label="Augmenter"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    {/* Raccourci : tout livrer */}
                    {!isComplete && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "SET_QTY", stopId: stop.id, lineId: l.id, qty: ordered })}
                        className="ml-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-muted hover:text-foreground"
                      >
                        Tout
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={[
                    "text-sm font-bold tabular-nums",
                    current >= ordered ? "text-emerald-600 dark:text-emerald-400" : "text-warning",
                  ].join(" ")}>
                    {current} / {ordered}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paiements */}
      {!settled && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted px-1">Paiement reçu</h3>

          {draft.payments.map((p) => (
            <PaymentRow
              key={p.id}
              entry={p}
              stopId={stop.id}
              canDelete={draft.payments.length > 1}
              dispatch={dispatch}
            />
          ))}

          <button
            type="button"
            onClick={() => dispatch({ type: "ADD_PAYMENT", stopId: stop.id })}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Ajouter un mode de paiement
          </button>

          {/* Récap paiement */}
          <div className={[
            "rounded-xl border px-4 py-3",
            balance === 0
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              : balance < 0
              ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
              : "border-border bg-card",
          ].join(" ")}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Total dû</span>
              <span className="font-semibold tabular-nums text-foreground">{fmtXOF(totalDue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Reçu</span>
              <span className="font-semibold tabular-nums text-foreground">{fmtXOF(totalPaid)}</span>
            </div>
            {balance !== 0 && (
              <div className="mt-1 flex items-center justify-between border-t border-border pt-1 text-sm">
                <span className={balance > 0 ? "text-warning" : "text-muted"}>
                  {balance > 0 ? "Reste à percevoir" : "Surplus"}
                </span>
                <span className={[
                  "font-bold tabular-nums",
                  balance > 0 ? "text-warning" : "text-muted",
                ].join(" ")}>
                  {fmtXOF(Math.abs(balance))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Résultat de l'arrêt */}
      {!settled && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted px-1">Résultat de l'arrêt</h3>
          <div className="grid grid-cols-3 gap-2">
            {(["DONE", "PARTIAL", "FAILED"] as const).map((outcome) => {
              const labels = { DONE: "Livré ✓", PARTIAL: "Partiel", FAILED: "Échec ✗" };
              const cls = {
                DONE:    draft.outcome === "DONE"    ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border bg-card text-foreground",
                PARTIAL: draft.outcome === "PARTIAL" ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "border-border bg-card text-foreground",
                FAILED:  draft.outcome === "FAILED"  ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "border-border bg-card text-foreground",
              }[outcome];
              return (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => dispatch({ type: "SET_OUTCOME", stopId: stop.id, outcome })}
                  className={`rounded-xl border-2 py-3 text-sm font-semibold transition-all ${cls}`}
                >
                  {labels[outcome]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Erreur */}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* Statut déjà traité */}
      {settled && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="font-semibold">Arrêt déjà traité</span>
          </div>
          {stop.amountCollected != null && (
            <div className="mt-2 text-sm text-muted">
              Encaissé : <span className="font-bold text-foreground">{fmtXOF(stop.amountCollected)}</span>
              {stop.paymentMode && (
                <span className="ml-2">
                  · {{ CASH: "Espèces", MOBILE_MONEY: "Mobile money", CREDIT: "Crédit", MIXED: "Paiement mixte" }[stop.paymentMode] ?? stop.paymentMode}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* CTA fixe en bas */}
      {!settled && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-4 py-4 backdrop-blur-sm">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Enregistrement…
              </>
            ) : (
              <><Check className="h-5 w-5" /> Valider l'arrêt</>
            )}
          </button>
          {!draft.outcome && (
            <p className="mt-2 text-center text-xs text-muted">Sélectionnez un résultat avant de valider.</p>
          )}
          {draft.outcome !== null && !paymentOk && (
            <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400">
              ⚠ Renseignez un montant perçu ou sélectionnez "Crédit client" pour valider.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DriveClient({ id }: { id: string }) {
  const [trip, setTrip]       = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);

  // Index de l'arrêt actuellement affiché
  const [currentIdx, setCurrentIdx] = useState(0);

  // État local des saisies (réducteur)
  const [drafts, dispatch] = useReducer(draftReducer, {});

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ item: Trip }>(`/delivery-trips/${id}`);
      const t = res.item;
      setTrip(t);

      // Positionner sur le premier arrêt non traité
      const stops = (t.stops ?? []).sort((a, b) => a.sequence - b.sequence);
      const firstPending = stops.findIndex((s) => !isSettled(s.status));
      setCurrentIdx(firstPending >= 0 ? firstPending : 0);
    } catch (e) { setErr(errMessage(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const stops = useMemo(
    () => (trip?.stops ?? []).sort((a, b) => a.sequence - b.sequence),
    [trip]
  );

  const currentStop = stops[currentIdx] ?? null;
  const totalSettled = stops.filter((s) => isSettled(s.status)).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted">Chargement de la tournée…</p>
        </div>
      </div>
    );
  }

  if (!trip || err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-background">
        <AlertCircle className="h-10 w-10 text-danger" />
        <p className="text-center text-sm text-foreground">{err ?? "Tournée introuvable."}</p>
        <Link href="/app/trips" className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground">
          ← Retour aux tournées
        </Link>
      </div>
    );
  }

  // Tournée non démarrée ou terminée
  if (trip.status !== "IN_PROGRESS") {
    const STATUS_MSG: Partial<Record<TripStatus, string>> = {
      DRAFT:   "La tournée n'a pas encore démarré.",
      LOADED:  "La tournée est chargée — en attente du départ.",
      DONE:    "Tournée terminée.",
      CLOSED:  "Tournée clôturée.",
      CANCELLED: "Tournée annulée.",
    };
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-background text-center">
        <Truck className="h-10 w-10 text-muted opacity-40" />
        <p className="text-sm text-foreground">{STATUS_MSG[trip.status] ?? trip.status}</p>
        <Link href={`/app/trips/${id}`} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
          Voir la fiche tournée
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header mobile compact ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/app/trips/${id}`} className="rounded-lg border border-border bg-card p-2 text-muted" aria-label="Retour">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground truncate">{trip.number}</div>
            <div className="text-xs text-muted">
              {totalSettled} / {stops.length} arrêt{stops.length > 1 ? "s" : ""} traité{totalSettled > 1 ? "s" : ""}
            </div>
          </div>
          {/* Barre de progression compacte */}
          <div className="flex gap-1 shrink-0">
            {stops.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentIdx(i)}
                aria-label={`Arrêt ${s.sequence}`}
                className={[
                  "h-2 rounded-full transition-all",
                  i === currentIdx ? "w-6 bg-primary" : isSettled(s.status) ? "w-2 bg-emerald-400" : "w-2 bg-border",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── Navigation arrêts ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-4 py-2 overflow-x-auto">
        {stops.map((s, i) => {
          const settled = isSettled(s.status);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentIdx(i)}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                i === currentIdx
                  ? "bg-primary text-primary-foreground"
                  : settled
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-card text-muted border border-border",
              ].join(" ")}
            >
              {settled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {s.clientName ?? `Arrêt ${s.sequence}`}
            </button>
          );
        })}
      </div>

      {/* ── Corps ────────────────────────────────────────────────────────────── */}
      <main className="px-4 pt-4">
        {currentStop ? (
          <StopView
            stop={currentStop}
            tripId={id}
            draft={drafts[currentStop.id] ?? { qtys: {}, payments: [{ id: "init", mode: "CASH", amount: "", provider: "", reference: "" }], outcome: null }}
            dispatch={dispatch}
            onValidated={async () => {
              await load();
              // Passer automatiquement au prochain arrêt non traité
              const next = stops.findIndex((s, i) => i > currentIdx && !isSettled(s.status));
              if (next >= 0) setCurrentIdx(next);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-base font-bold text-foreground">Tous les arrêts sont traités</p>
            <p className="text-sm text-muted">Retournez à la fiche tournée pour la clôturer.</p>
            <Link
              href={`/app/trips/${id}`}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              Terminer la tournée →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}