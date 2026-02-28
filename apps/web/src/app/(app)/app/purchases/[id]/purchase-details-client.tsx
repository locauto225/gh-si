"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiGet, apiPatch, apiPost } from "@/lib/api";

type Supplier = { id: string; name: string; isActive: boolean };
type Warehouse = { id: string; code: string; name: string; isActive: boolean };
type Product = { id: string; sku: string; name: string; unit: string; isActive: boolean };

type PurchaseStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

type PurchaseLine = {
  id: string;
  productId: string;
  product: Product;
  qtyOrdered: number;
  unitPrice: number;
  qtyReceived: number;
};

type PurchaseOrder = {
  id: string;
  number?: string | null;
  status: PurchaseStatus;
  supplierId: string;
  warehouseId: string;
  supplier: Supplier;
  warehouse: Warehouse;
  note?: string | null;
  lines: PurchaseLine[];
  createdAt: string;
  updatedAt?: string;
};

// ✅ Labels métier centralisés
const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Brouillon",
  ORDERED: "Commandé",
  PARTIALLY_RECEIVED: "Réception partielle",
  RECEIVED: "Réceptionné",
  CANCELLED: "Annulé",
};

const STATUS_CLS: Record<PurchaseStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-200",
  ORDERED: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
  PARTIALLY_RECEIVED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
};

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dt));
  } catch {
    return dt;
  }
}

export default function PurchaseDetailsClient({ id }: { id: string }) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<PurchaseStatus | null>(null);
  const [savingReceive, setSavingReceive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Quantité à réceptionner par ligne
  const [receiveNow, setReceiveNow] = useState<Record<string, string>>({});

  const total = useMemo(() => {
    if (!po) return 0;
    return po.lines.reduce((sum, l) => sum + (l.qtyOrdered || 0) * (l.unitPrice || 0), 0);
  }, [po]);

  const receivedAll = useMemo(() => {
    if (!po) return false;
    return po.lines.every((l) => (l.qtyReceived ?? 0) >= (l.qtyOrdered ?? 0));
  }, [po]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: PurchaseOrder }>(`/purchases/${id}`);
      setPo(res.item);
      const init: Record<string, string> = {};
      for (const l of res.item.lines) init[l.id] = "0";
      setReceiveNow(init);
    } catch (e: unknown) {
      setErr(errMessage(e));
      setPo(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(next: PurchaseStatus) {
    if (!po) return;
    setErr(null);
    setSuccess(null);
    setSavingStatus(next);
    try {
      await apiPatch(`/purchases/${po.id}/status`, { status: next });
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSavingStatus(null);
    }
  }

  function remainingQty(line: PurchaseLine) {
    const r = (line.qtyOrdered ?? 0) - (line.qtyReceived ?? 0);
    return r < 0 ? 0 : r;
  }

  async function onReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!po) return;
    setErr(null);
    setSuccess(null);

    if (po.status === "CANCELLED") return setErr("Ce bon de commande est annulé.");
    if (po.status === "RECEIVED") return setErr("Ce bon de commande est déjà entièrement réceptionné.");

    const payloadLines = po.lines
      .map((l) => {
        const raw = receiveNow[l.id] ?? "0";
        const qty = Math.trunc(
          Number(String(raw).replace(/\s/g, "").replace(/,/g, "."))
        );
        return {
          productId: l.productId || l.product?.id,
          qtyReceived: Number.isFinite(qty) ? qty : 0,
          remaining: remainingQty(l),
        };
      })
      .filter((x) => x.qtyReceived > 0 && !!x.productId);

    if (payloadLines.length === 0)
      return setErr("Veuillez saisir au moins une quantité reçue (supérieure à 0).");

    const overQty = payloadLines.find((x) => x.qtyReceived > x.remaining);
    if (overQty)
      return setErr("La quantité saisie dépasse le restant à réceptionner sur une ligne.");

    setSavingReceive(true);
    try {
      await apiPost(`/purchases/${po.id}/receive`, {
        lines: payloadLines.map((x) => ({
          productId: x.productId,
          qtyReceived: x.qtyReceived,
        })),
      });
      setSuccess("Réception enregistrée.");
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSavingReceive(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
        Chargement…
      </div>
    );
  }

  if (!po) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Bon de commande introuvable."}
        </div>
        <Link
          href="/app/purchases"
          className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          ← Retour aux achats
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Feedback */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Carte en-tête */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            {/* Fil d'Ariane */}
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Link href="/app/purchases" className="hover:underline">
                Achats
              </Link>
              <span className="mx-0.5">/</span>
              {/* ✅ Numéro ou ID court — pas d'UUID complet */}
              <span className="font-mono">{po.number?.trim() || po.id.slice(-8)}</span>
            </div>

            <div className="grid gap-1.5 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Fournisseur :</span>{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {po.supplier?.name ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Entrepôt :</span>{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {po.warehouse?.name ?? "—"}
                  {po.warehouse?.code && (
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                      ({po.warehouse.code})
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Créé le :</span>{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {fmtDate(po.createdAt)}
                </span>
              </div>
              {po.note && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Note :</span>{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">{po.note}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            {/* Statut */}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLS[po.status]}`}>
              {STATUS_LABELS[po.status]}
            </span>

            <div className="text-sm text-slate-600 dark:text-slate-300">
              Total :{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-50">
                {formatXOF(total)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/app/purchases"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                ← Retour
              </Link>

              {/* ✅ "Valider la commande" — sans "(Commander)" */}
              <button
                type="button"
                onClick={() => changeStatus("ORDERED")}
                disabled={savingStatus !== null || po.status !== "DRAFT"}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
              >
                {savingStatus === "ORDERED" ? "Validation…" : "Valider la commande"}
              </button>

              {/* ✅ "Annuler" avec busy label explicite */}
              <button
                type="button"
                onClick={() => changeStatus("CANCELLED")}
                disabled={
                  savingStatus !== null ||
                  po.status === "CANCELLED" ||
                  po.status === "RECEIVED"
                }
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
              >
                {savingStatus === "CANCELLED" ? "Annulation…" : "Annuler"}
              </button>

              {/* ✅ "Clôturer" — sans "(Réceptionné)" */}
              <button
                type="button"
                onClick={() => changeStatus("RECEIVED")}
                disabled={
                  savingStatus !== null ||
                  po.status === "CANCELLED" ||
                  po.status === "RECEIVED" ||
                  !receivedAll
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                {savingStatus === "RECEIVED" ? "Clôture…" : "Clôturer"}
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </div>

      {/* Lignes + réception */}
      <form
        onSubmit={onReceive}
        className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Titre descriptif */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Lignes de commande
          </div>
          {/* ✅ Busy label explicite */}
          <button
            type="submit"
            disabled={
              savingReceive ||
              po.status === "CANCELLED" ||
              po.status === "RECEIVED"
            }
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {savingReceive ? "Enregistrement…" : "Enregistrer la réception"}
          </button>
        </div>

        {po.lines.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucune ligne sur ce bon de commande.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Commandé</th>
                  <th className="px-4 py-3 text-right">Reçu</th>
                  <th className="px-4 py-3 text-right">Restant</th>
                  {/* ✅ "Prix unit." — plus de "PU" */}
                  <th className="px-4 py-3 text-right">Prix unit.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">À réceptionner</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => {
                  const remaining = remainingQty(l);
                  const lineTotal = (l.qtyOrdered ?? 0) * (l.unitPrice ?? 0);
                  const disabled =
                    po.status === "CANCELLED" ||
                    po.status === "RECEIVED" ||
                    remaining === 0;

                  return (
                    <tr
                      key={l.id}
                      className="border-t border-slate-200 odd:bg-slate-50/40 dark:border-slate-800 dark:odd:bg-slate-950/20"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {l.product?.name ?? "—"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[l.product?.sku, l.product?.unit].filter(Boolean).join(" · ")}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {l.qtyOrdered}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {l.qtyReceived ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            remaining > 0
                              ? "font-medium text-amber-700 dark:text-amber-300"
                              : "text-slate-400 dark:text-slate-500"
                          }
                        >
                          {remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {formatXOF(l.unitPrice ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {formatXOF(lineTotal)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <input
                          value={receiveNow[l.id] ?? "0"}
                          onChange={(e) =>
                            setReceiveNow((prev) => ({ ...prev, [l.id]: e.target.value }))
                          }
                          inputMode="numeric"
                          disabled={disabled}
                          placeholder="0"
                          className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {/* ✅ "max N" plus explicite */}
                        {!disabled && (
                          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Maximum : {remaining}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ✅ Note métier sans tutoiement */}
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          La réception peut être effectuée en plusieurs fois. Le statut passe automatiquement
          en <span className="font-medium">Réception partielle</span> tant que des quantités restent
          à réceptionner, puis en <span className="font-medium">Réceptionné</span> une fois tout reçu.
        </div>
      </form>
    </div>
  );
}