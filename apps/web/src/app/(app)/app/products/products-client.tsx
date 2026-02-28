"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, apiGet, apiPost } from "@/lib/api";

type Category = { id: string; name: string; slug: string };

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  isActive: boolean;
  categoryId?: string | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "active" | "inactive" | "all";

const UNIT_PRESETS = ["bouteille", "canette", "pack", "carton", "caisse", "bidon", "fût"] as const;

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getErrMsg(e: unknown, fallback = "Erreur"): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

export default function ProductsClient() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtres liste
  const [status, setStatus] = useState<StatusFilter>("active");
  const [q, setQ] = useState("");

  // Catégories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  // ✅ Création catégorie inline — plus de toggle, section dédiée visible directement
  const [showCatCreate, setShowCatCreate] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Formulaire produit
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("bouteille");
  const [unitCustom, setUnitCustom] = useState("");
  const [priceXof, setPriceXof] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isCustomUnit = unit === "__other__";
  const finalUnit = isCustomUnit ? unitCustom.trim() : unit;

  const price = useMemo(() => {
    const v = Number(String(priceXof).replace(/\s/g, "").replace(/,/g, "."));
    if (!Number.isFinite(v) || v < 0) return 0;
    return Math.trunc(v);
  }, [priceXof]);

  // ✅ Désactivation bouton si champs obligatoires manquants
  const canSubmit = sku.trim().length > 0 && name.trim().length > 0 && (!isCustomUnit || unitCustom.trim().length > 0);

  // ✅ Filtrage liste côté client
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.category?.name ?? "").toLowerCase().includes(s)
    );
  }, [items, q]);

  async function loadCategories() {
    try {
      const res = await apiGet<{ items: Category[] }>("/categories");
      setCategories(res.items ?? []);
    } catch {
      setCategories([]);
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: Product[] }>(`/products?status=${status}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du chargement"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);
  useEffect(() => { loadCategories(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ item: Product }>("/products", {
        sku: sku.trim(),
        name: name.trim(),
        ...(categoryId ? { categoryId } : {}),
        unit: finalUnit || "unité",
        price,
        isActive,
      });

      // ✅ Message de succès
      setSuccess(`"${res.item?.name ?? name.trim()}" ajouté au catalogue.`);

      setSku("");
      setName("");
      setUnit("bouteille");
      setUnitCustom("");
      setCategoryId("");
      setPriceXof("0");
      setIsActive(true);
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la création"));
    } finally {
      setSaving(false);
    }
  }

  async function onCreateCategory() {
    const catName = newCategoryName.trim();
    if (!catName) return;
    setCreatingCategory(true);
    setErr(null);
    try {
      const res = await apiPost<{ item: Category }>("/categories", { name: catName });
      setNewCategoryName("");
      setShowCatCreate(false);
      await loadCategories();
      setCategoryId(res.item.id);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la création de la catégorie"));
    } finally {
      setCreatingCategory(false);
    }
  }

  async function onToggleStatus(p: Product) {
    setUpdatingId(p.id);
    setErr(null);
    try {
      await apiFetch(`/products/${p.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la mise à jour du statut"));
    } finally {
      setUpdatingId(null);
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

      {/* ============================================================
          Formulaire création
      ============================================================ */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Ajouter un produit
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          {/* SKU */}
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU-001"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              required
            />
          </div>

          {/* Nom */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Bière Flag 33cl"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              required
            />
          </div>

          {/* Catégorie */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Catégorie <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <div className="flex gap-1">
                {/* ✅ Bouton avec label textuel, pas juste ↻ */}
                <button
                  type="button"
                  onClick={loadCategories}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  title="Rafraîchir"
                >
                  ↻
                </button>
                {/* ✅ Toggle explicite et stable */}
                <button
                  type="button"
                  onClick={() => { setShowCatCreate((v) => !v); setNewCategoryName(""); }}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    showCatCreate
                      ? "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  }`}
                >
                  {showCatCreate ? "Annuler" : "+ Catégorie"}
                </button>
              </div>
            </div>

            {/* ✅ Création catégorie visible directement si toggle actif */}
            {showCatCreate ? (
              <div className="mt-1 flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ex : Vins, Alcools…"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCreateCategory(); } }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={onCreateCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  {/* ✅ Busy label explicite */}
                  {creatingCategory ? "Création…" : "Créer"}
                </button>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">— Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Unité */}
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Unité</label>
            <select
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                if (e.target.value !== "__other__") setUnitCustom("");
              }}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              {UNIT_PRESETS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="__other__">Autre…</option>
            </select>

            {isCustomUnit && (
              <input
                value={unitCustom}
                onChange={(e) => setUnitCustom(e.target.value)}
                placeholder="Ex : sachet"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                autoFocus
              />
            )}
          </div>

          {/* Prix */}
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Prix (FCFA)</label>
            <input
              value={priceXof}
              onChange={(e) => setPriceXof(e.target.value)}
              inputMode="numeric"
              placeholder="1500"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            {/* ✅ Label plus guidant */}
            Disponible à la vente dès la création
          </label>

          {/* ✅ Bouton désactivé si champs obligatoires manquants */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {/* ✅ CTA clair + busy correct */}
            {saving ? "Création…" : "Ajouter au catalogue"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </form>

      {/* ============================================================
          Liste
      ============================================================ */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        {/* Header avec filtres dédiés */}
        <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="flex flex-wrap items-center gap-3">
            {/* ✅ Titre descriptif */}
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
              {loading ? "Chargement…" : `${filtered.length} produit${filtered.length > 1 ? "s" : ""}`}
            </div>

            {/* Recherche */}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (nom, SKU, catégorie…)"
              className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            {/* Filtre statut */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="all">Tous</option>
            </select>

            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              Rafraîchir
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {q.trim()
              ? "Aucun produit ne correspond."
              : status === "inactive"
              ? "Aucun produit inactif."
              : status === "all"
              ? "Aucun produit dans le catalogue."
              : "Aucun produit actif pour l'instant."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Unité</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {p.sku}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {p.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.unit}</td>
                    <td className="px-4 py-3 tabular-nums">{formatXOF(p.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          p.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
                        }`}
                      >
                        {p.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(p)}
                        disabled={updatingId === p.id}
                        className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${
                          p.isActive
                            ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                            : "bg-slate-900 font-medium text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
                        }`}
                      >
                        {/* ✅ Busy label explicite */}
                        {updatingId === p.id
                          ? "Mise à jour…"
                          : p.isActive
                          ? "Désactiver"
                          : "Réactiver"}
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