"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiGet, apiPost, apiFetch } from "@/lib/api";

type InvoiceStatus = "DRAFT" | "ISSUED" | "SENT" | "ACCEPTED" | "ERROR" | "CANCELLED";
type FneStatus = "PENDING" | "SENT" | "ERROR" | null;

type Client = { id: string; name: string };
type Warehouse = { id: string; code: string; name: string };
type Product = { id: string; sku: string; name: string; unit: string };

type InvoiceLine = {
  id: string;
  productId: string;
  product?: Product | null;
  qty: number;
  unitPrice: number;
  taxCode?: string | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  lineTotal?: number;
};

type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  clientId?: string | null;
  client?: Client | null;
  warehouseId: string;
  warehouse?: Warehouse | null;
  note?: string | null;
  subtotal?: number;
  taxTotal?: number;
  total: number;
  fneStatus?: FneStatus;
  fneLastError?: string | null;
  fneSentAt?: string | null;
  lines: InvoiceLine[];
  createdAt: string;
  updatedAt?: string;
};

// ✅ Tables de labels centralisées
const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  SENT: "Transmise",
  ACCEPTED: "Validée",
  ERROR: "Erreur",
  CANCELLED: "Annulée",
};

const FNE_STATUS_LABELS: Record<Exclude<FneStatus, null>, string> = {
  PENDING: "En attente",
  SENT: "Envoyée",
  ERROR: "Erreur FNE",
};

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function normalizeTaxRateBp(rate: unknown): number | null {
  if (rate == null) return null;
  const n = typeof rate === "number" ? rate : Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 1) return Math.round(n * 10000);
  if (n <= 100) return Math.round(n * 100);
  return Math.round(n);
}

function formatTaxRate(rate: unknown): string {
  const bp = normalizeTaxRateBp(rate);
  if (!bp) return "—";
  const pct = bp / 100;
  return `${Math.round(pct * 100) / 100}%`;
}

function computeTaxAmount(base: number, rateBp: number | null): number | null {
  if (!Number.isFinite(base) || !rateBp || rateBp <= 0) return null;
  return Math.round(base * (rateBp / 10000));
}

function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message ?? fallback;
  return (e as { message?: string })?.message ?? fallback;
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "slate";
}) {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function getStatusTone(status: InvoiceStatus): "green" | "amber" | "red" | "slate" {
  if (status === "ACCEPTED" || status === "SENT") return "green";
  if (status === "ISSUED") return "amber";
  if (status === "ERROR") return "red";
  return "slate";
}

function getFneTone(fne: FneStatus): "green" | "amber" | "red" | "slate" {
  if (fne === "SENT") return "green";
  if (fne === "PENDING") return "amber";
  if (fne === "ERROR") return "red";
  return "slate";
}

export default function InvoiceDetailsClient({ id }: { id: string }) {
  const [item, setItem] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Busy states séparés par action — pas d'effet de bord inter-boutons
  const [issueBusy, setIssueBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  const lineCount = item?.lines?.length ?? 0;

  const subtotal = useMemo(() => {
    if (!item) return 0;
    return typeof item.subtotal === "number" ? item.subtotal : item.total;
  }, [item]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: Invoice }>(`/invoices/${id}`);
      setItem(res.item);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du chargement"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onIssue() {
    if (!item) return;
    setIssueBusy(true);
    setErr(null);
    try {
      const res = await apiFetch<{ item: Invoice }>(`/invoices/${item.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ISSUED" }),
      });
      setItem(res.item);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de l'émission"));
    } finally {
      setIssueBusy(false);
    }
  }

  async function onCancel() {
    if (!item) return;
    setCancelBusy(true);
    setErr(null);
    try {
      const res = await apiFetch<{ item: Invoice }>(`/invoices/${item.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      setItem(res.item);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de l'annulation"));
    } finally {
      setCancelBusy(false);
    }
  }

  async function onSendFne() {
    if (!item) return;
    setSendBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ item: Invoice }>(`/invoices/${item.id}/send-fne`);
      setItem(res.item);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de l'envoi FNE"));
    } finally {
      setSendBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
        Chargement…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        {err ?? "Facture introuvable."}{" "}
        <Link href="/app/invoices" className="underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">
                {item.number}
              </div>
              {/* ✅ Label depuis table centralisée */}
              <Badge tone={getStatusTone(item.status)}>
                {INVOICE_STATUS_LABELS[item.status] ?? item.status}
              </Badge>
              {/* ✅ Badge FNE sans préfixe "FNE:" brut */}
              {item.fneStatus && (
                <Badge tone={getFneTone(item.fneStatus)}>
                  FNE · {FNE_STATUS_LABELS[item.fneStatus]}
                </Badge>
              )}
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-300">
              Client :{" "}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {item.client?.name ?? "Comptoir"}
              </span>
              {" · "}
              Entrepôt :{" "}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {item.warehouse?.name ?? "—"}
              </span>
              {item.warehouse?.code && (
                <span className="text-slate-500 dark:text-slate-400"> ({item.warehouse.code})</span>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Créée le {fmtDate(item.createdAt)}
              {item.fneSentAt ? ` · Envoyée FNE le ${fmtDate(item.fneSentAt)}` : ""}
            </div>

            {item.fneStatus === "ERROR" && item.fneLastError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                <div className="text-xs font-medium">Dernière erreur FNE</div>
                <div className="mt-1">{item.fneLastError}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/invoices"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              ← Retour
            </Link>

            {/* ✅ Bouton Émettre — busy isolé, libellé clair */}
            <button
              type="button"
              disabled={issueBusy || item.status !== "DRAFT"}
              onClick={onIssue}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {issueBusy ? "Émission…" : "Émettre"}
            </button>

            {/* ✅ Bouton Annuler — busy isolé */}
            <button
              type="button"
              disabled={cancelBusy || item.status === "CANCELLED" || item.status === "ACCEPTED"}
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              {cancelBusy ? "Annulation…" : "Annuler"}
            </button>

            {/* ✅ Bouton Envoyer FNE — busy isolé */}
            <button
              type="button"
              disabled={sendBusy || (item.status !== "ISSUED" && item.status !== "ERROR")}
              onClick={onSendFne}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              {sendBusy ? "Envoi…" : "Envoyer à la FNE"}
            </button>
          </div>
        </div>

        {item.note && (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Note</span>
            <div className="mt-1">{item.note}</div>
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </div>

      {/* Lignes */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Titre descriptif + pluriel correct */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Lignes de facturation</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lineCount} ligne{lineCount > 1 ? "s" : ""}
          </div>
        </div>

        {lineCount > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  {/* ✅ "PU" → "Prix unit." */}
                  <th className="px-4 py-3 text-right">Prix unit.</th>
                  <th className="px-4 py-3">Taxe</th>
                  <th className="px-4 py-3 text-right">Total ligne</th>
                </tr>
              </thead>
              <tbody>
                {item.lines.map((l) => {
                  const base = Math.trunc((l.unitPrice ?? 0) * (l.qty ?? 0));
                  const rateBp = normalizeTaxRateBp(l.taxRate);
                  const taxAmount =
                    typeof l.taxAmount === "number" ? l.taxAmount : computeTaxAmount(base, rateBp);
                  const lineTotal = typeof l.lineTotal === "number" ? l.lineTotal : base;

                  return (
                    <tr
                      key={l.id}
                      className="border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.product?.name ?? "—"}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {l.product?.sku ? `SKU ${l.product.sku}` : ""}
                          {l.product?.unit ? ` · ${l.product.unit}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{l.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatXOF(l.unitPrice ?? 0)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {l.taxCode || rateBp || taxAmount ? (
                          <div className="space-y-0.5">
                            <div className="text-xs">
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {l.taxCode ?? "Taxe"}
                              </span>
                              {rateBp && (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {" "}· {formatTaxRate(rateBp)}
                                </span>
                              )}
                            </div>
                            {typeof taxAmount === "number" && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {formatXOF(taxAmount)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatXOF(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucune ligne sur cette facture.
          </div>
        )}
      </div>

      {/* Totaux */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-slate-600 dark:text-slate-300">Sous-total HT</div>
            <div className="tabular-nums font-medium">{formatXOF(subtotal)}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-slate-600 dark:text-slate-300">Taxes</div>
            <div className="tabular-nums font-medium">{formatXOF(item.taxTotal ?? 0)}</div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-base dark:border-slate-800">
            <div className="font-semibold">Total TTC</div>
            <div className="tabular-nums font-semibold">{formatXOF(item.total ?? 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}