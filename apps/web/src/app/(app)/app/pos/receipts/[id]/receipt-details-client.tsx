"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";
import { ChevronRight } from "lucide-react";

type Product = { id: string; sku: string; name: string; unit: string };

type ReceiptItem = {
  id: string; number: string; issuedAt?: string | null; createdAt: string;
  totalTTC: number; amountPaid: number;
  store: { id: string; name: string };
  sale: {
    id: string; number: string; status: string;
    channel?: "DEPOT" | "STORE"; fulfillment?: "PICKUP" | "DELIVERY";
    shippingFee?: number; totalHT: number; totalTTC: number;
    amountPaid?: number | null; postedAt?: string | null;
    client?: { id: string; name: string } | null;
    warehouse?: { id: string; code: string; name: string } | null;
    lines: Array<{ id: string; qty: number; unitPrice: number; product: Product }>;
  };
};

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dt)); }
  catch { return String(dt); }
}
function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount ?? 0);
}
function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as any).message);
  return "Erreur";
}

export default function ReceiptDetailsClient({ id }: { id: string }) {
  const [item, setItem] = useState<ReceiptItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try { const res = await apiGet<{ item: ReceiptItem }>(`/pos/receipts/${id}`); setItem(res.item); }
    catch (e: unknown) { setErr(getErrMsg(e)); setItem(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (loading) return <div className="py-12 text-center text-sm text-muted">Chargement…</div>;

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Ticket introuvable."}
        </div>
        <Link href="/app/pos/receipts"
          className="inline-flex rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
          ← Retour tickets
        </Link>
      </div>
    );
  }

  const sale = item.sale;
  const rendu = item.amountPaid - item.totalTTC;

  return (
    <div className="space-y-5">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/pos/receipts" className="hover:text-foreground hover:underline underline-offset-4">Tickets</Link>
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
              <span className="rounded-full border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-2.5 py-0.5 text-xs font-medium text-muted">
                Ticket caisse
              </span>
            </div>
            <div className="text-xs text-muted">
              Magasin : <span className="font-medium text-foreground">{item.store.name}</span>
              {" · "}Émis : {fmt(item.issuedAt ?? item.createdAt)}
              {" · "}Vente :{" "}
              <Link href={`/app/sales/${sale.id}`} className="font-medium text-foreground hover:underline underline-offset-4">
                {sale.number}
              </Link>
              {" · "}Client : <span className="font-medium text-foreground">{sale.client?.name ?? "Comptoir"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/pos/receipts"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
              ← Retour tickets
            </Link>
            <Link href={`/app/sales/${sale.id}`}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
              Voir la vente →
            </Link>
          </div>
        </div>

        {/* Totaux */}
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-3 py-2.5">
            <div className="text-xs text-muted">Total TTC</div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{formatXOF(item.totalTTC ?? 0)}</div>
          </div>
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-3 py-2.5">
            <div className="text-xs text-muted">Payé</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatXOF(item.amountPaid ?? 0)}</div>
            {rendu > 0 && (
              <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                Rendu : {formatXOF(rendu)}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-3 py-2.5">
            <div className="text-xs text-muted">Mode</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">
              {(sale.fulfillment ?? "PICKUP") === "DELIVERY" ? "Livraison" : "Enlèvement"}
            </div>
            {typeof sale.shippingFee === "number" && sale.shippingFee > 0 && (
              <div className="mt-0.5 text-xs text-muted tabular-nums">Frais : {formatXOF(sale.shippingFee)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 text-sm font-semibold text-foreground rounded-t-xl">
          Détail des articles
        </div>

        {sale.lines?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">PU</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l) => {
                  const total = (l.qty ?? 0) * (l.unitPrice ?? 0);
                  return (
                    <tr key={l.id}
                      className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.product?.name ?? "—"}</div>
                        <div className="text-xs text-muted">
                          {l.product?.sku}{l.product?.unit ? ` · ${l.product.unit}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatXOF(l.unitPrice ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatXOF(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border">
                {[
                  { label: "Total HT", value: sale.totalHT },
                  { label: "Total TTC", value: sale.totalTTC, bold: true },
                ].map(({ label, value, bold }) => (
                  <tr key={label} className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs text-muted">{label}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${bold ? "text-base font-bold" : "font-semibold"}`}>
                      {formatXOF(value ?? 0)}
                    </td>
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