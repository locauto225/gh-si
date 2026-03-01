"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { ChevronRight, Package, Truck, CheckCircle, XCircle, Clock } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Warehouse    = { id: string; code: string; name: string };
type Client       = { id: string; name: string };
type Product      = { id: string; sku: string; name: string; unit: string };
type InvoiceMini  = { id: string; number: string; status: string } | null;
type DeliveryMini = { id: string; number: string; status: string; createdAt: string };

type OrderLine = {
  id: string; productId: string; qty: number; unitPrice: number;
  qtyPrepared?: number; qtyDelivered?: number;
  product?: Product | null;
};

type OrderStatus = "DRAFT" | "CONFIRMED" | "PREPARED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

type OrderItem = {
  id: string; number: string; status: OrderStatus;
  note: string | null; totalHT: number; totalTTC: number;
  createdAt: string; updatedAt: string;
  client?: Client | null;
  fulfillment?: "PICKUP" | "DELIVERY";
  shippingFee?: number;
  confirmedAt?: string | null;
  preparedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  warehouse: Warehouse;
  lines: OrderLine[];
  invoice?: InvoiceMini;
  deliveries?: DeliveryMini[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "XOF", maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function fmtDate(dt?: string | null) {
  if (!dt) return null;
  try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt)); }
  catch { return dt; }
}

function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as any).message);
  return "Erreur";
}

// ─── Stepper horizontal compact ───────────────────────────────────────────────

function getSteps(isDelivery: boolean): { key: OrderStatus; label: string }[] {
  return [
    { key: "DRAFT",     label: "Brouillon"                      },
    { key: "CONFIRMED", label: "Confirmée"                      },
    { key: "PREPARED",  label: "Préparée"                       },
    { key: "SHIPPED",   label: isDelivery ? "Expédiée" : "Remise"  },
    { key: "DELIVERED", label: isDelivery ? "Livrée"   : "Retirée" },
  ];
}

const STEP_IDX: Record<string, number> = {
  DRAFT: 0, CONFIRMED: 1, PREPARED: 2, SHIPPED: 3, DELIVERED: 4, CANCELLED: -1,
};

function Stepper({ status, isDelivery }: { status: OrderStatus; isDelivery: boolean }) {
  const steps = getSteps(isDelivery);
  const cur = STEP_IDX[status] ?? 0;
  if (status === "CANCELLED") return null;
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1">
      {steps.map((s, i) => {
        const done   = i < cur;
        const active = i === cur;
        const future = i > cur;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-1.5">
              {/* Pastille */}
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                done   ? "bg-emerald-500 text-white"
                : active ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`whitespace-nowrap text-xs font-medium ${
                active ? "text-foreground" : done ? "text-emerald-600 dark:text-emerald-400" : "text-muted"
              }`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-px w-8 shrink-0 ${i < cur ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bandeau "action requise" — le cœur de l'UX ──────────────────────────────

type ActionBannerProps = {
  item: OrderItem;
  busy: boolean;
  onTransition: (next: string) => void;
};

function ActionBanner({ item, busy, onTransition }: ActionBannerProps) {
  const isDelivery  = item.fulfillment === "DELIVERY";
  const hasBLs      = (item.deliveries?.length ?? 0) > 0;
  const hasRemaining = item.lines.some(l => l.qty - (l.qtyDelivered ?? 0) > 0);
  // Reliquat confirmé : au moins un BL clôturé (livré ou partiel) ET des qtés restantes
  const hasConfirmedReliquat = hasRemaining && (item.deliveries?.some(d =>
    d.status === "PARTIALLY_DELIVERED" || d.status === "DELIVERED"
  ) ?? false);
  // Tous les BLs terminés ET plus aucun reliquat → invite à clôturer la commande
  const allBLsDone = isDelivery && hasBLs && !hasRemaining && (item.deliveries?.every(d =>
    d.status === "DELIVERED" || d.status === "CANCELLED" || d.status === "FAILED"
  ) ?? false);

  switch (item.status) {

    case "DRAFT":
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <div className="font-semibold text-amber-900 dark:text-amber-200">En attente de confirmation</div>
                <div className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
                  Vérifiez les produits et les quantités, puis confirmez l'accord avec le client.
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <button
                type="button" disabled={busy}
                onClick={() => onTransition("CONFIRMED")}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                {busy ? "…" : "Confirmer l'accord →"}
              </button>
              <button
                type="button" disabled={busy}
                onClick={() => { if (!confirm("Annuler cette commande ?")) return; onTransition("CANCELLED"); }}
                className="text-xs text-amber-600 underline underline-offset-4 hover:text-amber-800 disabled:opacity-50 dark:text-amber-400"
              >
                Annuler la commande
              </button>
            </div>
          </div>
        </div>
      );

    case "CONFIRMED":
      return (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
              <div>
                <div className="font-semibold text-violet-900 dark:text-violet-200">À préparer en entrepôt</div>
                <div className="mt-0.5 text-sm text-violet-700 dark:text-violet-300">
                  L'accord est enregistré. Préparez la marchandise puis marquez la commande comme prête.
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <button
                type="button" disabled={busy}
                onClick={() => onTransition("PREPARED")}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
              >
                {busy ? "…" : "Marchandise prête →"}
              </button>
              <button
                type="button" disabled={busy}
                onClick={() => { if (!confirm("Annuler cette commande ?")) return; onTransition("CANCELLED"); }}
                className="text-xs text-violet-600 underline underline-offset-4 hover:text-violet-800 disabled:opacity-50 dark:text-violet-400"
              >
                Annuler la commande
              </button>
            </div>
          </div>
        </div>
      );

    case "PREPARED":
      return (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
              <div>
                <div className="font-semibold text-sky-900 dark:text-sky-200">Prête — à expédier</div>
                <div className="mt-0.5 text-sm text-sky-700 dark:text-sky-300">
                  {isDelivery
                    ? hasBLs
                      ? "Bon(s) de livraison créé(s). Vérifiez la préparation puis marquez comme expédiée."
                      : "Un bon de livraison est requis avant de pouvoir expédier cette commande."
                    : "Le client passe récupérer la commande. Marquez comme remise quand c'est fait."}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isDelivery && hasRemaining && (
                  <Link
                    href={`/app/deliveries/new?mode=order&orderId=${item.id}`}
                    className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:bg-transparent dark:text-sky-300"
                  >
                    + Créer un BL
                  </Link>
                )}
                <button
                  type="button"
                  disabled={busy || (isDelivery && !hasBLs)}
                  onClick={() => onTransition("SHIPPED")}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-sky-500"
                >
                  {busy ? "…" : isDelivery ? "Marquer expédiée →" : "Marquer comme remise →"}
                </button>
              </div>
              {isDelivery && !hasBLs && (
                <p className="text-xs text-sky-700 dark:text-sky-400">
                  ⚠ Créez d'abord un bon de livraison pour débloquer l'expédition.
                </p>
              )}
            </div>
          </div>
        </div>
      );

    case "SHIPPED":
      return (
        <div className={`rounded-xl border p-4 ${
          allBLsDone
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            : "border-primary/30 bg-primary/5"
        }`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {allBLsDone
                ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                : <Truck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              }
              <div>
                <div className={`font-semibold ${allBLsDone ? "text-emerald-900 dark:text-emerald-200" : "text-foreground"}`}>
                  {allBLsDone
                    ? "Tous les bons de livraison sont livrés ✓"
                    : isDelivery ? "En transit" : "En attente de retrait"}
                </div>
                <div className={`mt-0.5 text-sm ${allBLsDone ? "text-emerald-700 dark:text-emerald-300" : "text-muted"}`}>
                  {allBLsDone
                    ? "Aucun reliquat restant. Confirmez la livraison pour clôturer la commande."
                    : isDelivery
                      ? hasBLs
                        ? `${item.deliveries!.length} bon${item.deliveries!.length > 1 ? "s" : ""} de livraison en cours.`
                        : "Confirmez la réception par le client une fois la livraison effectuée."
                      : "Confirmez que le client a bien récupéré la commande."}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {isDelivery && hasConfirmedReliquat && (
                <Link
                  href={`/app/deliveries/new?mode=order&orderId=${item.id}`}
                  className="rounded-lg border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                >
                  + Créer un BL (reliquat)
                </Link>
              )}
              <button
                type="button" disabled={busy}
                onClick={() => onTransition("DELIVERED")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
                  allBLsDone
                    ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500"
                    : "bg-primary"
                }`}
              >
                {busy ? "…" : isDelivery ? "Confirmer la livraison ✓" : "Confirmer le retrait ✓"}
              </button>
            </div>
          </div>
        </div>
      );

    case "DELIVERED":
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <div className="font-semibold text-emerald-900 dark:text-emerald-200">{isDelivery ? "Commande livrée" : "Commande retirée"}</div>
              <div className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-300">
                {isDelivery ? "Livrée le" : "Retirée le"} {fmtDate(item.deliveredAt) ?? "—"}.
                {item.invoice?.id && (
                  <> · <Link href={`/app/invoices/${item.invoice.id}`} className="underline underline-offset-4 hover:opacity-80">Voir la facture</Link></>
                )}
              </div>
            </div>
          </div>
        </div>
      );

    case "CANCELLED":
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <div className="font-semibold text-red-900 dark:text-red-200">Commande annulée</div>
              <div className="mt-0.5 text-sm text-red-700 dark:text-red-300">Cette commande ne peut plus être modifiée.</div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Badge statut BL ─────────────────────────────────────────────────────────

const BL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon", PREPARED: "Prêt", OUT_FOR_DELIVERY: "En livraison",
  PARTIALLY_DELIVERED: "Partiel", DELIVERED: "Livré",
  FAILED: "Échoué", CANCELLED: "Annulé",
};

function BLBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === "DELIVERED"           ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
    : s === "OUT_FOR_DELIVERY"  ? "border-primary/30 bg-primary/5 text-primary"
    : s === "PARTIALLY_DELIVERED" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
    : s === "FAILED"            ? "border-red-200 bg-red-50 text-red-600"
    : s === "CANCELLED"         ? "border-border text-muted"
    : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {BL_STATUS_LABELS[s] ?? s}
    </span>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OrderDetailsClient({ id }: { id: string }) {
  const [item, setItem]     = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ item: OrderItem }>(`/orders/${id}`);
      setItem(res.item);
    } catch (e) { setErr(getErrMsg(e)); setItem(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function doTransition(next: string) {
    if (!item) return;
    setBusy(true); setErr(null);
    try {
      const res = await apiPatch<{ item: OrderItem }>(`/orders/${id}/status`, { status: next });
      setItem(res.item);
    } catch (e) { setErr(getErrMsg(e)); }
    finally { setBusy(false); }
  }

  // ── Rendu chargement / erreur ──────────────────────────────────────────────

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Chargement…</div>;
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Commande introuvable."}
        </div>
        <Link href="/app/orders"
          className="inline-flex rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  const isDelivery = item.fulfillment === "DELIVERY";

  return (
    <div className="space-y-4">

      {/* ── Fil d'Ariane ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/orders" className="hover:text-foreground hover:underline underline-offset-4">
          Commandes
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{item.number}</span>
      </div>

      {/* ── Bandeau action — TOUJOURS EN PREMIER ──────────────────────────── */}
      <ActionBanner item={item} busy={busy} onTransition={doTransition} />

      {/* ── Erreur API ────────────────────────────────────────────────────── */}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* ── En-tête commande ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm">

        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-foreground">{item.number}</span>
              <span className="text-xs text-muted">·</span>
              <span className="text-sm font-semibold text-foreground">{item.client?.name ?? "—"}</span>
            </div>
            <div className="text-xs text-muted">
              {item.warehouse.name} · {isDelivery ? "Livraison" : "Enlèvement"} · Créée le {fmtDate(item.createdAt) ?? "—"}
            </div>
          </div>
          <Link href="/app/orders"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted hover:text-foreground">
            ← Retour
          </Link>
        </div>

        {/* Stepper */}
        <div className="border-b border-border px-4 py-3">
          <Stepper status={item.status} isDelivery={item.fulfillment === "DELIVERY"} />
        </div>

        {/* Résumé financier */}
        <div className="flex flex-wrap items-center gap-6 px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Total TTC</div>
            <div className="text-xl font-bold text-foreground tabular-nums">{formatXOF(item.totalTTC)}</div>
          </div>
          {item.totalHT !== item.totalTTC && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Dont HT</div>
              <div className="text-sm font-medium text-muted tabular-nums">{formatXOF(item.totalHT)}</div>
            </div>
          )}
          {isDelivery && (item.shippingFee ?? 0) > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Frais livraison</div>
              <div className="text-sm font-medium text-muted tabular-nums">{formatXOF(item.shippingFee ?? 0)}</div>
            </div>
          )}
          {item.invoice?.id && (
            <Link href={`/app/invoices/${item.invoice.id}`}
              className="ml-auto rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
              Voir la facture →
            </Link>
          )}
        </div>

        {item.note && (
          <div className="border-t border-border px-4 py-3 text-sm text-muted">
            <span className="font-medium text-foreground">Note :</span> {item.note}
          </div>
        )}
      </div>

      {/* ── Lignes de commande ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">
            Produits commandés
            <span className="ml-2 text-xs font-normal text-muted">
              {item.lines.length} référence{item.lines.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]">
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3 text-right">Qté</th>
                {(item.deliveries?.length ?? 0) > 0 && (
                  <th className="px-4 py-3 text-right">Livré</th>
                )}
                <th className="px-4 py-3 text-right">Prix unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {item.lines.map((l) => {
                const delivered = l.qtyDelivered ?? 0;
                const remaining = l.qty - delivered;
                const isComplete = remaining <= 0;
                return (
                  <tr key={l.id}
                    className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_8%)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{l.product?.name ?? "—"}</div>
                      <div className="text-xs text-muted">{l.product?.sku} · {l.product?.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{l.qty}</td>
                    {(item.deliveries?.length ?? 0) > 0 && (
                      <td className="px-4 py-3 text-right tabular-nums">
                        {isComplete
                          ? <span className="font-medium text-emerald-600 dark:text-emerald-400">{delivered} ✓</span>
                          : delivered > 0
                          ? <span className="font-medium text-amber-600 dark:text-amber-400">{delivered} / {l.qty}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{formatXOF(l.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {formatXOF(l.qty * l.unitPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr>
                <td colSpan={(item.deliveries?.length ?? 0) > 0 ? 4 : 3}
                  className="px-4 py-3 text-right text-xs text-muted">Total TTC</td>
                <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-foreground">
                  {formatXOF(item.totalTTC)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Bons de livraison ─────────────────────────────────────────────── */}
      {(item.deliveries?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-foreground">
              Bons de livraison
              <span className="ml-2 text-xs font-normal text-muted">{item.deliveries!.length}</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {item.deliveries!.map((d) => (
              <Link key={d.id} href={`/app/deliveries/${d.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_oklab,var(--card),var(--background)_25%)]">
                <span className="font-mono text-sm font-semibold text-foreground">{d.number}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{fmtDate(d.createdAt)}</span>
                  <BLBadge status={d.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}