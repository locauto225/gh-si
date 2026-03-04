// apps/web/src/app/(app)/app/stock/transfers/[id]/transfer-details-client.tsx
"use client";

import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TransferReceiveForm } from "./transfer-receive-form";

type Warehouse = { id: string; code: string; name: string; isActive: boolean; kind: "DEPOT" | "STORE" };

type TransferLine = {
  id: string;
  productId: string;
  qty: number;
  qtyReceived: number;
  note?: string | null;
  product?: { id: string; sku: string; name: string; unit?: string | null } | null;
};

type TransferItem = {
  id: string;
  status: string;
  note?: string | null;
  createdAt: string;
  shippedAt?: string | null;
  receivedAt?: string | null;
  fromWarehouse: Warehouse;
  toWarehouse: Warehouse;
  lines: TransferLine[];
  journeyId?: string | null;
  purpose?: string | null;
  deliveryId?: string | null;
  deliveryNumber?: string | null;
  delivery?: { id: string; number?: string | null } | null;
};

// ✅ Labels français
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SHIPPED: "Expédié",
  PARTIALLY_RECEIVED: "Reçu partiellement",
  RECEIVED: "Reçu",
  CANCELLED: "Annulé",
};

const KIND_LABELS: Record<string, string> = {
  DEPOT: "Entrepôt",
  STORE: "Magasin",
};

function fmtDate(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return String(dt);
  }
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "").toUpperCase();
  const tone =
    s === "DRAFT" ? "border-border bg-card text-muted"
    : s === "SHIPPED" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
    : s === "PARTIALLY_RECEIVED" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
    : s === "RECEIVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
    : s === "CANCELLED" ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
    : "border-border bg-card text-muted";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  );
}

function errMsg(e: unknown) {
  if (e instanceof ApiError) return e.message || `Erreur API (${e.status})`;
  return (e as { message?: string })?.message ?? "Erreur";
}

export function TransferDetailsClient({ id }: { id: string }) {
  const [item, setItem] = useState<TransferItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [shipNote, setShipNote] = useState<string>("");
  const [receiveNote, setReceiveNote] = useState<string>("");
  const [journeyPeerId, setJourneyPeerId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: TransferItem }>(`/stock/transfers/${id}`);
      const next = res.item ?? null;
      setItem(next);

      try {
        const jid = next?.journeyId;
        if (jid) {
          const list = await apiGet<{ items: Array<{ id: string; journeyId?: string | null }> }>(`/stock/transfers?limit=200`);
          const peer = (list.items ?? []).find((t) => (t as TransferItem).journeyId === jid && t.id !== next?.id);
          setJourneyPeerId(peer?.id ?? null);
        } else {
          setJourneyPeerId(null);
        }
      } catch {
        setJourneyPeerId(null);
      }
    } catch (e) {
      setItem(null);
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    setActionErr(null);
    setActionSuccess(null);
    setShipNote("");
    setReceiveNote("");
    setJourneyPeerId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => {
    const lines = item?.lines ?? [];
    const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const received = lines.reduce((s, l) => s + (Number(l.qtyReceived) || 0), 0);
    return { qty, received, delta: received - qty };
  }, [item?.lines]);

  const status = String(item?.status || "").toUpperCase();
  const canShip = status === "DRAFT";
  const canReceive = status === "SHIPPED" || status === "PARTIALLY_RECEIVED";
  const isFinal = status === "RECEIVED" || status === "CANCELLED";

  async function onShip() {
    if (!item) return;
    setActionBusy(true);
    setActionErr(null);
    setActionSuccess(null);
    try {
      await apiPost(`/stock/transfers/${item.id}/ship`, { note: shipNote.trim() || null });
      setActionSuccess("Transfert expédié — en attente de réception par la destination.");
      await load();
    } catch (e) {
      setActionErr(errMsg(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function onReceive(payload: { note: string | null; lines: Array<{ productId: string; qtyReceived: number }> }) {
    if (!item) return;
    setActionBusy(true);
    setActionErr(null);
    setActionSuccess(null);
    try {
      await apiPost(`/stock/transfers/${item.id}/receive`, payload);
      setActionSuccess("Réception enregistrée.");
      await load();
    } catch (e) {
      setActionErr(errMsg(e));
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-muted">Chargement…</div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        {err}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
        Transfert introuvable.
      </div>
    );
  }

  const deliveryId = (item.delivery?.id ?? item.deliveryId) as string | null | undefined;
  const deliveryNumber = (item.delivery?.number ?? item.deliveryNumber) as string | null | undefined;

  return (
    <div className="space-y-4">

      {/* ============================================================
          Header
      ============================================================ */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* ✅ Référence courte — pas l'UUID complet */}
            <span className="font-mono text-sm font-semibold text-foreground">
              Transfert {String(id).slice(0, 8)}
            </span>
            <StatusBadge status={item.status} />
            <span className="text-xs text-muted">créé le {fmtDate(item.createdAt)}</span>
          </div>

          <button
            type="button"
            disabled={actionBusy}
            onClick={load}
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted hover:text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] disabled:opacity-50 transition-colors"
          >
            Rafraîchir
          </button>
        </div>

        {/* Trajet source → destination */}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2">
            <div className="text-xs text-muted">Source</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {item.fromWarehouse?.name}
              <span className="ml-1 text-xs font-normal text-muted">({item.fromWarehouse?.code})</span>
            </div>
            {/* ✅ Type traduit */}
            <div className="mt-0.5 text-xs text-muted">
              {KIND_LABELS[item.fromWarehouse?.kind] ?? item.fromWarehouse?.kind}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-3 py-2">
            <div className="text-xs text-muted">Destination</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {item.toWarehouse?.name}
              <span className="ml-1 text-xs font-normal text-muted">({item.toWarehouse?.code})</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {KIND_LABELS[item.toWarehouse?.kind] ?? item.toWarehouse?.kind}
            </div>
          </div>
        </div>

        {/* Dates et quantités — ✅ séparation claire "Réceptionné le" vs "Qté réceptionnée" */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">Expédié le</div>
            <div className="mt-0.5 text-sm text-foreground">{fmtDate(item.shippedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Réceptionné le</div>
            <div className="mt-0.5 text-sm text-foreground">{fmtDate(item.receivedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Qté envoyée</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{totals.qty}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Qté réceptionnée</div>
            <div className={`mt-0.5 text-sm font-semibold tabular-nums ${totals.delta < 0 ? "text-amber-700 dark:text-amber-300" : totals.delta > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
              {totals.received}
              {totals.delta !== 0 && (
                <span className="ml-1 text-xs font-normal">
                  ({totals.delta > 0 ? `+${totals.delta}` : totals.delta})
                </span>
              )}
            </div>
          </div>
        </div>

        {item.note && (
          <div className="mt-4">
            <div className="text-xs text-muted">Motif</div>
            <div className="mt-0.5 break-words text-sm text-foreground">{item.note}</div>
          </div>
        )}
      </div>

      {/* BL lié + Trajet (si applicable) */}
      {(deliveryId || item.journeyId) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {deliveryId && (
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted">Bon de livraison lié</div>
                {/* Le statut du BL est géré côté BL — on invite à l'ouvrir */}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {deliveryNumber ? `BL ${deliveryNumber}` : "Bon de livraison"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Expédier ou réceptionner depuis la fiche BL synchronise automatiquement ce transfert.
              </p>
              <Link
                href={`/app/deliveries/${deliveryId}`}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Ouvrir la fiche BL →
              </Link>
            </div>
          )}

          {item.journeyId && (
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="text-xs text-muted">Trajet multi-étapes</div>
              <div className="mt-0.5 font-mono text-xs text-foreground break-all">{item.journeyId}</div>
              {journeyPeerId ? (
                <Link
                  href={`/app/stock/transfers/${journeyPeerId}`}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] transition-colors"
                >
                  Voir l'autre étape →
                </Link>
              ) : (
                <div className="mt-2 text-xs text-muted">Autre étape non disponible</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback actions */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {actionSuccess}
        </div>
      )}
      {actionErr && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {actionErr}
        </div>
      )}

      {/* ============================================================
          Action — Expédier
      ============================================================ */}
      {canShip && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-sm font-semibold text-foreground">Expédier ce transfert</div>
          <div className="mt-1 text-xs text-muted">
            Confirme l'envoi des produits. La destination pourra ensuite enregistrer la réception.
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={shipNote}
              onChange={(e) => setShipNote(e.target.value)}
              placeholder="Note d'expédition (optionnel)"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
            />
            <button
              type="button"
              disabled={actionBusy}
              onClick={onShip}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {actionBusy ? "Expédition…" : "Marquer comme expédié"}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          Action — Réceptionner
      ============================================================ */}
      {canReceive && (
        <TransferReceiveForm
          lines={(item.lines ?? []).map((l) => ({
            id: l.id,
            productId: l.productId,
            qty: Number(l.qty) || 0,
            qtyReceived: Number(l.qtyReceived) || 0,
            note: l.note ?? null,
            product: l.product ?? null,
          }))}
          disabled={!canReceive || actionBusy}
          busy={actionBusy}
          note={receiveNote}
          onNoteChange={setReceiveNote}
          onSubmit={onReceive}
          submitLabel="Enregistrer la réception"
          showTotals={true}
          showDeltaColumn={true}
        />
      )}

      {/* Écart de réception — bannière */}
      {(() => {
        const s = String(item.status || "").toUpperCase();
        if (!(s === "PARTIALLY_RECEIVED" || s === "RECEIVED")) return null;
        if (totals.delta === 0) return null;
        const isLoss = totals.delta < 0;
        const cls = isLoss
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100";
        const chipBase = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
        const chip = isLoss
          ? `${chipBase} border-amber-300/60 bg-card/60 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100`
          : `${chipBase} border-emerald-300/60 bg-card/60 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100`;

        return (
          <div className={`rounded-xl border px-4 py-3 ${cls}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-card/60 dark:bg-black/20">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <path d="M10.29 3.86 2.82 17a2 2 0 0 0 1.72 3h14.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold">Écart de réception</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={chip}>Envoyé : {totals.qty}</span>
                    <span className={chip}>Réceptionné : {totals.received}</span>
                    <span className={chip}>Écart : {totals.delta > 0 ? `+${totals.delta}` : totals.delta}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("transfer-lines") ?? document.getElementById("transfer-receive");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] transition-colors"
              >
                Voir les lignes
              </button>
            </div>
          </div>
        );
      })()}

      {/* ============================================================
          Lignes en lecture seule (si pas en cours de réception)
      ============================================================ */}
      {!canReceive && (
        <div
          id="transfer-lines"
          className="rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-3">
            <div className="text-sm font-medium">
              Lignes ({item.lines?.length ?? 0})
            </div>
            {isFinal && totals.delta === 0 && (
              <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Aucun écart — réception conforme.</div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Envoyé</th>
                  <th className="px-4 py-3 text-right">Réceptionné</th>
                  <th className="px-4 py-3 text-right">Écart</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {item.lines?.length ? (
                  item.lines.map((l) => {
                    const sent = Number(l.qty) || 0;
                    const rec = Number(l.qtyReceived) || 0;
                    const diff = rec - sent;
                    const diffClass =
                      diff === 0 ? "text-muted"
                      : diff < 0 ? "text-amber-700 dark:text-amber-200"
                      : "text-emerald-700 dark:text-emerald-200";

                    return (
                      <tr key={l.id} className="border-t border-border hover:bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{l.product?.name ?? "—"}</div>
                          <div className="text-xs text-muted">
                            {l.product?.sku ? `SKU : ${l.product.sku}` : ""}
                            {l.product?.unit ? ` · ${l.product.unit}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{sent}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{rec}</td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${diffClass}`}>
                          {diff === 0 ? "0" : diff > 0 ? `+${diff}` : String(diff)}
                        </td>
                        <td className="px-4 py-3 text-muted">{l.note ?? "—"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">Aucune ligne.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}