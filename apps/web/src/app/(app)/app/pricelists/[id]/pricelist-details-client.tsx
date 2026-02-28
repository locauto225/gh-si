"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { ProductPicker, type ProductPickerProduct } from "@/components/ProductPicker";

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  isActive: boolean;
  deletedAt: string | null;
  brand: string | null;
  barcode: string | null;
  packSize: number | null;
  taxCode: string | null;
  taxRate: number | null;
};

type PriceListItem = {
  id: string;
  priceListId: string;
  productId: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
};

type PriceList = {
  id: string;
  code: string;
  name: string;
  note: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PriceListItem[];
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

export default function PricelistDetailsClient({ id }: { id: string }) {
  const [data, setData] = useState<PriceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);

  // Formulaire en-tête
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Ajout produit
  const [selectedProduct, setSelectedProduct] = useState<ProductPickerProduct | null>(null);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [savingAdd, setSavingAdd] = useState(false);

  // Mise à jour prix inline
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: PriceList }>(`/pricelists/${id}`);
      setData(res.item);
      setName(res.item.name ?? "");
      setNote(res.item.note ?? "");
      setIsActive(!!res.item.isActive);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSaveHeader(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSavingHeader(true);
    setErr(null);
    setSuccess(null);
    try {
      const res = await apiPatch<{ item: PriceList }>(`/pricelists/${data.id}`, {
        name: name.trim(),
        note: note.trim() || null,
        isActive,
      });
      setData(res.item);
      setSuccess("Modifications enregistrées.");
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSavingHeader(false);
    }
  }

  async function onAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setErr(null);
    setSuccess(null);
    const pid = selectedProduct?.id ?? "";
    if (!pid) {
      setErr("Veuillez sélectionner un produit.");
      return;
    }
    setSavingAdd(true);
    try {
      await apiPost<{ item: PriceListItem }>(`/pricelists/${data.id}/items`, {
        productId: pid,
        unitPrice: Number(unitPrice) || 0,
      });
      setSuccess("Prix ajouté.");
      setSelectedProduct(null);
      setUnitPrice(0);
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSavingAdd(false);
    }
  }

  async function onUpdateItem(itemId: string, nextPrice: number) {
    if (!data) return;
    setErr(null);
    setSuccess(null);
    setSavingItemId(itemId);
    try {
      await apiPatch<{ item: PriceListItem }>(`/pricelists/${data.id}/items/${itemId}`, {
        unitPrice: Number(nextPrice) || 0,
      });
      setSuccess("Prix mis à jour.");
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSavingItemId(null);
    }
  }

  async function onDeleteItem(itemId: string) {
    if (!data) return;
    setErr(null);
    setSuccess(null);
    try {
      await apiDelete<{ ok: boolean }>(`/pricelists/${data.id}/items/${itemId}`);
      setSuccess("Produit retiré de la grille.");
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
        Chargement…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Grille tarifaire introuvable."}
        </div>
        <Link
          href="/app/pricelists"
          className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          ← Retour aux tarifs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div>
          <Link
            href="/app/pricelists"
            className="text-xs text-slate-500 hover:underline dark:text-slate-400"
          >
            ← Tarifs
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {data.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {data.code}
            </span>
            {/* ✅ "Inactive" en français — plus d'UUID visible */}
            {!data.isActive && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* Paramètres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Paramètres de la grille
        </div>
        <form onSubmit={onSaveHeader} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              required
            />
          </div>
          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Note <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Commentaire…"
            />
          </div>
          <div className="md:col-span-2">
            {/* ✅ Label "Statut" — plus de "Active" anglais */}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Statut</label>
            <select
              value={isActive ? "yes" : "no"}
              onChange={(e) => setIsActive(e.target.value === "yes")}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-12 flex justify-end">
            <button
              type="submit"
              disabled={savingHeader}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {savingHeader ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>

      {/* Ajouter un prix produit */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        {/* ✅ Titre sans slash */}
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Ajouter un prix produit
        </div>
        <form onSubmit={onAddItem} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-6">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Produit</label>
            <div className="mt-1">
              <ProductPicker
                variant="compact"
                value={selectedProduct}
                onChange={(p) => {
                  setSelectedProduct(p);
                  setErr(null);
                }}
                placeholder="Rechercher par nom ou référence…"
              />
            </div>
            {/* ✅ Nom du produit sélectionné — plus d'UUID */}
            {selectedProduct && (
              <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Sélectionné : <span className="font-medium">{selectedProduct.name ?? selectedProduct.sku}</span>
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Prix unitaire <span className="font-normal text-slate-400">(FCFA)</span>
            </label>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              min={0}
            />
            {/* ✅ Astuce dev supprimée */}
          </div>

          <div className="md:col-span-3 flex items-end justify-end">
            <button
              type="submit"
              disabled={savingAdd || !selectedProduct}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {savingAdd ? "Ajout…" : "Ajouter le prix"}
            </button>
          </div>
        </form>
      </div>

      {/* Tableau des prix */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {/* ✅ "produit(s)" en français — plus de "Items" */}
            {data.items?.length ?? 0} produit{(data.items?.length ?? 0) > 1 ? "s" : ""} tarifé{(data.items?.length ?? 0) > 1 ? "s" : ""}
          </div>
        </div>

        {!data.items || data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucun produit tarifé pour l'instant.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                saving={savingItemId === it.id}
                onUpdate={onUpdateItem}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  saving,
  onUpdate,
  onDelete,
}: {
  item: PriceListItem;
  saving: boolean;
  onUpdate: (itemId: string, nextPrice: number) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const [value, setValue] = useState<number>(item.unitPrice);
  // ✅ Confirmation suppression inline
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setValue(item.unitPrice);
  }, [item.unitPrice]);

  const basePrice = item.product?.price ?? 0;
  const isDirty = value !== item.unitPrice;

  async function handleDelete() {
    setRemoving(true);
    await onDelete(item.id);
    setRemoving(false);
    setConfirmDelete(false);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {item.product?.name ?? "Produit inconnu"}
          </span>
          {/* ✅ SKU ou référence courte — plus de productId UUID */}
          {item.product?.sku && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {item.product.sku}
            </span>
          )}
          {item.product?.unit && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {item.product.unit}
            </span>
          )}
          {/* ✅ "Prix de base" en français — plus de "base: N" */}
          {basePrice > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Prix de base : {formatXOF(basePrice)}
            </span>
          )}
        </div>
        {item.product?.brand && (
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {item.product.brand}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          min={0}
        />
        <button
          type="button"
          onClick={() => onUpdate(item.id, value)}
          disabled={saving || !isDirty}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          {/* ✅ Busy label explicite */}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>

        {/* ✅ Confirmation suppression inline — plus de suppression directe */}
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={removing}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {removing ? "Suppression…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/30"
          >
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}