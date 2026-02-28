"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type Supplier = { id: string; name: string; isActive: boolean };
type Warehouse = { id: string; code: string; name: string; isActive: boolean };
type Product = { id: string; sku: string; name: string; unit: string; isActive: boolean };

type PurchaseLineInput = {
  productId: string;
  qtyOrdered: string;
  unitPrice: string;
};

type PurchaseStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

type Purchase = {
  id: string;
  number?: string | null;
  status: PurchaseStatus;
  supplier?: Supplier;
  warehouse?: Warehouse;
  note?: string | null;
  total?: number;
  createdAt: string;
};

// ✅ Labels métier centralisés
const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Brouillon",
  ORDERED: "Commandé",
  PARTIALLY_RECEIVED: "Réception partielle",
  RECEIVED: "Réceptionné",
  CANCELLED: "Annulé",
};

// ✅ Couleurs différenciées par statut
const STATUS_CLS: Record<PurchaseStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  ORDERED: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
  PARTIALLY_RECEIVED: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
};

type StatusFilter =
  | "all"
  | PurchaseStatus
  | "RECEIVED,PARTIALLY_RECEIVED";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "ORDERED", label: "Commandés" },
  { value: "PARTIALLY_RECEIVED", label: "Réception partielle" },
  { value: "RECEIVED", label: "Réceptionnés" },
  { value: "RECEIVED,PARTIALLY_RECEIVED", label: "Réceptions (toutes)" },
  { value: "CANCELLED", label: "Annulés" },
];

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

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

export default function PurchasesClient() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>("all");

  // Formulaire création
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseLineInput[]>([
    { productId: "", qtyOrdered: "1", unitPrice: "0" },
  ]);

  const totalPreview = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      const q = Math.trunc(Number(String(l.qtyOrdered).replace(/\s/g, "").replace(/,/g, ".")));
      const p = Math.trunc(Number(String(l.unitPrice).replace(/\s/g, "").replace(/,/g, ".")));
      if (Number.isFinite(q) && Number.isFinite(p) && q > 0 && p >= 0) sum += q * p;
    }
    return sum;
  }, [lines]);

  async function loadRefs() {
    try {
      const [sRes, wRes, pRes] = await Promise.all([
        apiGet<{ items: Supplier[] }>("/suppliers?limit=200"),
        apiGet<{ items: Warehouse[] }>("/warehouses?status=active"),
        // ✅ type explicite — plus de any[]
        apiGet<{ items: Product[] }>("/products?status=active"),
      ]);

      const activeSup = (sRes.items ?? []).filter((s) => s.isActive);
      const activeWh = (wRes.items ?? []).filter((w) => w.isActive);
      const activePrd = (pRes.items ?? []).filter((p) => p.isActive);

      setSuppliers(activeSup);
      setWarehouses(activeWh);
      setProducts(activePrd);

      if (!supplierId && activeSup[0]?.id) setSupplierId(activeSup[0].id);
      if (!warehouseId && activeWh[0]?.id) setWarehouseId(activeWh[0].id);
      if (!lines[0]?.productId && activePrd[0]?.id) {
        setLines([{ productId: activePrd[0].id, qtyOrdered: "1", unitPrice: "0" }]);
      }
    } catch {
      // Silencieux — erreur visible à la soumission du formulaire
    }
  }

  async function loadPurchases() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (status !== "all") qs.set("status", status);
      const res = await apiGet<{ items: Purchase[] }>(`/purchases?${qs}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(errMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { productId: products[0]?.id ?? "", qtyOrdered: "1", unitPrice: "0" },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<PurchaseLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    if (!supplierId) return setErr("Veuillez sélectionner un fournisseur.");
    if (!warehouseId) return setErr("Veuillez sélectionner un entrepôt.");

    const payloadLines = lines
      .map((l) => ({
        productId: l.productId,
        qtyOrdered: Math.trunc(
          Number(String(l.qtyOrdered).replace(/\s/g, "").replace(/,/g, "."))
        ),
        unitPrice: Math.trunc(
          Number(String(l.unitPrice).replace(/\s/g, "").replace(/,/g, "."))
        ),
      }))
      .filter(
        (l) =>
          l.productId &&
          Number.isFinite(l.qtyOrdered) &&
          l.qtyOrdered > 0 &&
          Number.isFinite(l.unitPrice) &&
          l.unitPrice >= 0
      );

    if (payloadLines.length === 0)
      return setErr("Veuillez ajouter au moins une ligne valide.");

    setSaving(true);
    try {
      await apiPost("/purchases", {
        supplierId,
        warehouseId,
        note: note.trim() || null,
        lines: payloadLines,
      });
      setSuccess("Bon de commande créé.");
      setNote("");
      setLines([{ productId: products[0]?.id ?? "", qtyOrdered: "1", unitPrice: "0" }]);
      await loadPurchases();
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Feedback succès */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Formulaire création */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        {/* ✅ Titre sans "(achat)" redondant */}
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Nouveau bon de commande
        </div>

        <div className="grid gap-3 md:grid-cols-10">
          <div className="md:col-span-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Fournisseur <span className="text-red-500">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              {/* ✅ Option claire sans tirets */}
              <option value="">Sélectionner un fournisseur</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Entrepôt <span className="text-red-500">*</span>
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Sélectionner un entrepôt</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Note <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Référence, commentaire…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Lignes de commande */}
        <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            Produits commandés
          </div>

          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-12">
                <div className="md:col-span-6">
                  <select
                    value={l.productId}
                    onChange={(e) => updateLine(idx, { productId: e.target.value })}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {/* ✅ Option sans tirets */}
                    <option value="">Sélectionner un produit</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <input
                    value={l.qtyOrdered}
                    onChange={(e) => updateLine(idx, { qtyOrdered: e.target.value })}
                    inputMode="numeric"
                    placeholder="Quantité"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <input
                    value={l.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                    inputMode="numeric"
                    placeholder="Prix unitaire (FCFA)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="md:col-span-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    aria-label="Supprimer la ligne"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              + Ajouter un produit
            </button>

            <div className="text-sm text-slate-600 dark:text-slate-300">
              Total estimé : <span className="font-semibold text-slate-900 dark:text-slate-100">{formatXOF(totalPreview)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end">
          {/* ✅ CTA clair — plus de "BC", ellipse correcte */}
          <button
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? "Création…" : "Créer le bon de commande"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </form>

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Compteur + pluriel correct */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
            {loading ? "Chargement…" : `${items.length} bon${items.length > 1 ? "s" : ""} de commande`}
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadPurchases}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {/* ✅ Plus de "Aucun BC." */}
            Aucun bon de commande.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Détail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((po) => (
                  <tr
                    key={po.id}
                    // ✅ Ligne cliquable
                    onClick={() => router.push(`/app/purchases/${po.id}`)}
                    className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {fmtDate(po.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {po.supplier?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {po.warehouse?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {/* ✅ Badge coloré selon statut */}
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLS[po.status]}`}>
                        {STATUS_LABELS[po.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {typeof po.total === "number" ? formatXOF(po.total) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/app/purchases/${po.id}`)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}