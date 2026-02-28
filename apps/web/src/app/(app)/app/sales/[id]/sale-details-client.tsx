"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { ChevronRight } from "lucide-react";

type Warehouse = { id: string; code: string; name: string };
type Client = { id: string; name: string };
type Product = { id: string; sku: string; name: string; unit: string; taxCode?: string | null; taxRate?: number | null };
type InvoiceMini = { id: string; number: string; status: string } | null;
type PosReceiptMini = { id: string; number: string; issuedAt?: string | null } | null;

type SaleLine = {
  id: string; productId: string; qty: number; unitPrice: number;
  qtyDelivered?: number; product?: Product | null;
};

type SaleItem = {
  id: string; number: string; status: "DRAFT" | "POSTED" | "CANCELLED";
  note: string | null; totalHT: number; totalTTC: number;
  paymentStatus?: string | null; amountPaid?: number | null;
  createdAt: string; updatedAt: string;
  client?: Client | null; channel?: "DEPOT" | "STORE";
  fulfillment?: "PICKUP" | "DELIVERY"; shippingFee?: number;
  posReceipt?: PosReceiptMini;
  store?: { id: string; code: string; name: string } | null;
  warehouse: Warehouse; lines: SaleLine; invoice?: InvoiceMini;
};

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount ?? 0);
}
function fmtDate(dt: string) {
  try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt)); }
  catch { return dt; }
}

const STATUS_LABELS: Record<string, string> = { DRAFT: "Brouillon", POSTED: "Validée", CANCELLED: "Annulée" };
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Non payée", PARTIALLY_PAID: "Partiellement payée", PARTIAL: "Partiel",
  PAID: "Payée", OVERPAID: "Surpayée", REFUNDED: "Remboursée",
};

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls = s === "POSTED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
    : s === "CANCELLED"
    ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
    : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] text-muted";
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{STATUS_LABELS[s] ?? s}</span>;
}

function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as Record<string, unknown>).message);
  return "Erreur";
}

export default function SaleDetailsClient({ id }: { id: string }) {
  const [item, setItem] = useState<SaleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canPost = useMemo(() => (item?.status ?? "DRAFT") === "DRAFT", [item?.status]);
  const canCancel = useMemo(() => (item?.status ?? "DRAFT") === "DRAFT", [item?.status]);
  const isPosted = item?.status === "POSTED";
  const isCancelled = item?.status === "CANCELLED";
  const isFinal = isPosted || isCancelled;

  const hasDeliverable = useMemo(() => {
    if (!isPosted || !item?.lines) return false;
    if ((item.fulfillment ?? "PICKUP") !== "DELIVERY") return false;
    return (item.lines as unknown as SaleLine[]).some((l) => l.qty - (l.qtyDelivered ?? 0) > 0);
  }, [isPosted, item]);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiGet<{ item: SaleItem }>(`/sales/${id}`);
      setItem(res.item);
    } catch (e: unknown) { setErr(getErrMsg(e)); setItem(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function setStatus(next: "POSTED" | "CANCELLED") {
    if (!item) return;
    setBusy(true); setErr(null); setSuccessMsg(null);
    try {
      const res = await apiPatch<{ item: SaleItem; invoice?: InvoiceMini; posReceipt?: PosReceiptMini }>(`/sales/${id}/status`, { status: next });
      const updated = res.item;
      if (res.invoice) (updated as any).invoice = res.invoice;
      if (res.posReceipt) (updated as any).posReceipt = res.posReceipt;
      setItem(updated);
      if (next === "POSTED") {
        setSuccessMsg(res.invoice ? "Vente validée — facture générée." : res.posReceipt ? "Vente validée — ticket généré." : "Vente validée.");
        if (res.invoice?.id) setTimeout(() => { window.location.href = `/app/invoices/${res.invoice!.id}`; }, 800);
        else if (res.posReceipt?.id) setTimeout(() => { window.location.href = `/app/pos/receipts/${res.posReceipt!.id}`; }, 800);
      } else {
        setSuccessMsg("Vente annulée.");
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === "INSUFFICIENT_STOCK") {
        const d = (e.details ?? {}) as Record<string, unknown>;
        setErr(`Stock insuffisant — disponible : ${d.available ?? "?"}, demandé : ${d.requested ?? "?"}.`);
      } else { setErr(getErrMsg(e)); }
    } finally { setBusy(false); }
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted">Chargement…</div>;

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Vente introuvable."}
        </div>
        <Link href="/app/sales" className="inline-flex rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
          ← Retour aux ventes
        </Link>
      </div>
    );
  }

  const lines = item.lines as unknown as SaleLine[];
  const originLabel = item.channel === "STORE"
    ? `Magasin${item.store ? ` · ${item.store.name} (${item.store.code})` : ""}`
    : `Dépôt · ${item.warehouse?.name} (${item.warehouse?.code})`;

  return (
    <div className="space-y-5">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/sales" className="hover:text-foreground hover:underline underline-offset-4">Ventes</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{item.number}</span>
      </div>

      {/* Carte principale */}
      <div className="rounded-xl border border-border bg-card shadow-sm">

        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-foreground">{item.number}</span>
              <StatusBadge status={item.status} />
            </div>
            <div className="text-xs text-muted">
              {originLabel} · Client : <span className="font-medium text-foreground">{item.client?.name ?? "Comptoir"}</span> · Créé le {fmtDate(item.createdAt)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/sales"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
              ← Retour
            </Link>

            {item.invoice?.id && (
              <Link href={`/app/invoices/${item.invoice.id}`}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
                Voir la facture →
              </Link>
            )}

            {item.posReceipt?.id && (
              <Link href={`/app/pos/receipts/${item.posReceipt.id}`}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
                Voir le ticket →
              </Link>
            )}

            {hasDeliverable && (
              <Link href={`/app/deliveries/new?saleId=${item.id}`}
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
                Créer un bon de livraison
              </Link>
            )}

            {!isFinal && (
              <>
                <button type="button" disabled={!canPost || busy} onClick={() => setStatus("POSTED")}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  title={item.channel === "STORE" ? "Valider — déstocke et génère le ticket" : "Valider — déstocke et génère la facture"}>
                  {busy ? "Validation…" : "Valider la vente"}
                </button>
                <button type="button" disabled={!canCancel || busy}
                  onClick={() => { if (!confirm("Confirmes-tu l'annulation de cette vente ?")) return; setStatus("CANCELLED"); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/20">
                  Annuler
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feedback */}
        {successMsg && (
          <div className="mx-4 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            {successMsg}
          </div>
        )}
        {err && (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}

        {/* Bandeau statut final */}
        {isFinal && (
          <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-sm ${
            isPosted
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-muted"
          }`}>
            {isPosted
              ? item.channel === "STORE"
                ? "Vente validée — le stock a été débité et le ticket généré."
                : "Vente validée — le stock a été débité et la facture générée."
              : "Vente annulée — aucune modification possible."}
          </div>
        )}

        {/* Totaux */}
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            { label: "Total TTC", value: formatXOF(item.totalTTC ?? 0), bold: true },
            { label: "Total HT",  value: formatXOF(item.totalHT ?? 0),  bold: false },
          ].map(({ label, value, bold }) => (
            <div key={label} className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-3 py-2.5">
              <div className="text-xs text-muted">{label}</div>
              <div className={`mt-0.5 tabular-nums ${bold ? "text-xl font-bold text-foreground" : "text-base font-semibold text-foreground"}`}>{value}</div>
            </div>
          ))}
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-3 py-2.5">
            <div className="text-xs text-muted">Paiement</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {item.paymentStatus ? (PAYMENT_STATUS_LABELS[item.paymentStatus] ?? item.paymentStatus) : "—"}
            </div>
            {typeof item.amountPaid === "number" && (
              <div className="text-xs text-muted tabular-nums">Payé : {formatXOF(item.amountPaid)}</div>
            )}
          </div>
        </div>

        {item.note && (
          <div className="px-4 pb-4">
            <div className="text-xs text-muted">Note</div>
            <div className="mt-1 rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-3 py-2 text-sm text-foreground">{item.note}</div>
          </div>
        )}
      </div>

      {/* Lignes */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 text-sm font-semibold text-foreground rounded-t-xl">
          Lignes de commande
        </div>

        {lines?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Commandé</th>
                  {isPosted && <th className="px-4 py-3 text-right">Livré</th>}
                  <th className="px-4 py-3 text-right">Prix unitaire</th>
                  <th className="px-4 py-3 text-right">Total ligne</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const total = (l.qty ?? 0) * (l.unitPrice ?? 0);
                  const p = l.product;
                  const delivered = l.qtyDelivered ?? 0;
                  const remaining = l.qty - delivered;
                  return (
                    <tr key={l.id} className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p?.name ?? "—"}</div>
                        <div className="text-xs text-muted">{p?.sku}{p?.unit ? ` · ${p.unit}` : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{l.qty}</td>
                      {isPosted && (
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={delivered > 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted"}>{delivered}</span>
                          {remaining > 0 && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">({remaining} restant)</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums">{formatXOF(l.unitPrice ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatXOF(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border">
                {[
                  { label: "Total HT",  value: item.totalHT },
                  { label: "Total TTC", value: item.totalTTC, bold: true },
                ].map(({ label, value, bold }) => (
                  <tr key={label} className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]">
                    <td colSpan={isPosted ? 4 : 3} className="px-4 py-3 text-right text-xs text-muted">{label}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${bold ? "text-base font-bold" : "font-semibold"}`}>{formatXOF(value ?? 0)}</td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-muted">Aucune ligne.</div>
        )}
      </div>
    </div>
  );
}