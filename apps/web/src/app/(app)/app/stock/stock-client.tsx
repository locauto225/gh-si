"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";

type Warehouse = { id: string; code: string; name: string; isActive: boolean; kind?: "DEPOT" | "STORE" };
type Store = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  warehouseId: string;
  warehouse?: { id: string; code: string; name: string } | null;
};
type Category = { id: string; name: string; slug: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  isActive: boolean;
  category?: Category | null;
};
type StockRow = { product: Product; quantity: number };

const LOW_THRESHOLD = 5;

type AlertFilter = "all" | "rupture" | "low";
type SortDir = "asc" | "desc" | "none";

function StockQty({ qty }: { qty: number }) {
  const tone = qty <= 0 ? "zero" : qty <= LOW_THRESHOLD ? "low" : "ok";
  return (
    <div className="inline-flex items-center justify-end gap-2">
      <span
        className={
          tone === "zero"
            ? "font-semibold text-red-700 dark:text-red-300"
            : tone === "low"
            ? "font-semibold text-orange-700 dark:text-orange-200"
            : "text-slate-900 dark:text-slate-100"
        }
      >
        {qty}
      </span>
      {tone === "low" && (
        <span className="inline-flex items-center rounded-md bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-900 dark:bg-orange-500/15 dark:text-orange-100">
          Stock bas
        </span>
      )}
      {tone === "zero" && (
        <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-900 dark:bg-red-500/15 dark:text-red-100">
          Rupture
        </span>
      )}
    </div>
  );
}

export default function StockClient() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [scope, setScope] = useState<"DEPOT" | "STORE">("DEPOT");
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("");

  const [rows, setRows] = useState<StockRow[]>([]);
  const [q, setQ] = useState("");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("none");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);

  // ============================================================
  // Data loading
  // ============================================================
  async function loadWarehouses(kind: "DEPOT" | "STORE") {
    try {
      const res = await apiGet<{ items: Warehouse[] }>(`/warehouses?status=active&kind=${kind}`);
      setWarehouses(res.items ?? []);
      if (kind === "DEPOT" && !warehouseId && (res.items ?? [])[0]?.id) {
        setWarehouseId((res.items ?? [])[0].id);
      }
    } catch {
      try {
        const resAll = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active");
        const items = (resAll.items ?? []).filter((w) =>
          (w as Warehouse & { kind?: string }).kind ? (w as Warehouse & { kind?: string }).kind === kind : kind === "DEPOT"
        );
        setWarehouses(items);
        if (kind === "DEPOT" && !warehouseId && items[0]?.id) setWarehouseId(items[0].id);
      } catch {
        setWarehouses([]);
      }
    }
  }

  async function loadStores() {
    try {
      const res = await apiGet<{ items: Store[] }>("/stores?status=active&limit=200");
      setStores(res.items ?? []);
    } catch {
      try {
        const res = await apiGet<{ items: Store[] }>("/stores?limit=200");
        setStores((res.items ?? []).filter((s) => (s as Store & { isActive?: boolean; deletedAt?: unknown }).isActive !== false));
      } catch {
        setStores([]);
      }
    }
  }

  async function loadStock(id: string) {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: StockRow[] }>(`/stock?warehouseId=${id}`);
      setRows(res.items ?? []);
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? "Erreur lors du chargement du stock");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses("DEPOT");
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (warehouseId) loadStock(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  useEffect(() => {
    setErr(null);
    setRows([]);
    setMoreOpen(false);
    setAlertFilter("all");
    setSortDir("none");
    if (scope === "DEPOT") {
      setStoreId("");
      loadWarehouses("DEPOT");
    } else {
      setWarehouseId("");
      setWarehouses([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    if (scope !== "STORE") return;
    const s = stores.find((x) => x.id === storeId);
    setWarehouseId(s?.warehouseId ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, storeId, stores]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      const container = moreBtnRef.current?.parentElement;
      if (container && !(container.contains(e.target as Node))) setMoreOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // ============================================================
  // Computed stats
  // ============================================================
  const stats = useMemo(() => {
    const ruptures = rows.filter((r) => r.quantity <= 0).length;
    const lowStock = rows.filter((r) => r.quantity > 0 && r.quantity <= LOW_THRESHOLD).length;
    const total = rows.length;
    return { ruptures, lowStock, total };
  }, [rows]);

  // ============================================================
  // Filtered + sorted rows
  // ============================================================
  const filtered = useMemo(() => {
    let result = rows;

    // Filtre texte
    const s = q.trim().toLowerCase();
    if (s) {
      result = result.filter((r) => {
        const p = r.product;
        return (
          p.name.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          (p.category?.name ?? "").toLowerCase().includes(s)
        );
      });
    }

    // Filtre alerte
    if (alertFilter === "rupture") result = result.filter((r) => r.quantity <= 0);
    else if (alertFilter === "low") result = result.filter((r) => r.quantity > 0 && r.quantity <= LOW_THRESHOLD);

    // Tri quantité
    if (sortDir === "asc") result = [...result].sort((a, b) => a.quantity - b.quantity);
    else if (sortDir === "desc") result = [...result].sort((a, b) => b.quantity - a.quantity);

    return result;
  }, [rows, q, alertFilter, sortDir]);

  // ============================================================
  // Context label (entrepôt ou magasin sélectionné)
  // ============================================================
  const contextLabel = useMemo(() => {
    if (scope === "STORE") {
      const s = stores.find((x) => x.id === storeId);
      return s ? `${s.name} (${s.code})` : null;
    }
    const w = warehouses.find((x) => x.id === warehouseId);
    return w ? `${w.name} (${w.code})` : null;
  }, [scope, storeId, stores, warehouseId, warehouses]);

  const hasData = warehouseId && !loading && rows.length > 0;
  const hasActiveFilters = alertFilter !== "all" || q.trim();

  return (
    <div className="space-y-6">

      {/* ============================================================
          Sélecteur d'emplacement + recherche
      ============================================================ */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Type */}
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-300">Type</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "DEPOT" | "STORE")}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="DEPOT">Entrepôt</option>
              <option value="STORE">Magasin</option>
            </select>
          </div>

          {/* Entrepôt ou Magasin */}
          {scope === "DEPOT" ? (
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-300">Entrepôt</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">— Choisir</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-300">Magasin</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">— Choisir</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Recherche */}
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">Recherche</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SKU, produit, catégorie…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </div>

      {/* ============================================================
          ✅ Raccourcis actions opérationnelles — bien visibles
      ============================================================ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/app/stock/transfers"
          className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-orange-300 hover:bg-orange-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-orange-900/50 dark:hover:bg-orange-950/20"
        >
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Transfert</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Déplacer du stock entre emplacements</div>
        </Link>

        <Link
          href="/app/stock/inventories"
          className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900/50 dark:hover:bg-blue-950/20"
        >
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Inventaire</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Saisir les quantités réelles</div>
        </Link>

        <Link
          href="/app/stock/returns"
          className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/20"
        >
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Retours</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Enregistrer un retour client</div>
        </Link>

        {/* ✅ Actions avancées — card discrète mais accessible */}
        <div className="relative">
          <button
            ref={moreBtnRef}
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className="flex w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950/40"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Avancé</div>
              <span className="text-xs text-slate-400">▾</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Corrections · Casse · Vol</div>
          </button>

          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
            >
              <Link
                href="/app/stock/moves"
                onClick={() => setMoreOpen(false)}
                className="block px-4 py-3 text-sm text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-950/30"
                role="menuitem"
              >
                <div className="font-medium">Corrections de stock</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ajuster manuellement une quantité</div>
              </Link>
              <div className="border-t border-slate-100 dark:border-slate-800" />
              <Link
                href="/app/stock/losses"
                onClick={() => setMoreOpen(false)}
                className="block px-4 py-3 text-sm text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-950/30"
                role="menuitem"
              >
                <div className="font-medium">Casse · Vol</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Déclarer une perte définitive</div>
              </Link>
              <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Opérations d'audit — à utiliser avec précaution.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          Tableau de stock
      ============================================================ */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">

        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">
              {contextLabel ? contextLabel : scope === "STORE" ? "Magasin" : "Entrepôt"}
            </div>
            <span className={[
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              scope === "STORE"
                ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-500/10 dark:text-blue-100"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
            ].join(" ")}>
              {scope === "STORE" ? "Magasin" : "Entrepôt"}
            </span>
          </div>

          {/* ✅ Stats alertes en temps réel */}
          {hasData && (
            <div className="flex items-center gap-2">
              {stats.ruptures > 0 && (
                <button
                  type="button"
                  onClick={() => setAlertFilter(alertFilter === "rupture" ? "all" : "rupture")}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    alertFilter === "rupture"
                      ? "border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
                      : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20",
                  ].join(" ")}
                  title="Filtrer sur les ruptures"
                >
                  {stats.ruptures} rupture{stats.ruptures > 1 ? "s" : ""}
                </button>
              )}
              {stats.lowStock > 0 && (
                <button
                  type="button"
                  onClick={() => setAlertFilter(alertFilter === "low" ? "all" : "low")}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    alertFilter === "low"
                      ? "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-200"
                      : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20",
                  ].join(" ")}
                  title="Filtrer sur les stocks bas"
                >
                  {stats.lowStock} stock{stats.lowStock > 1 ? "s" : ""} bas
                </button>
              )}
              {stats.ruptures === 0 && stats.lowStock === 0 && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Tout est OK
                </span>
              )}
            </div>
          )}
        </div>

        {/* Barre de contrôles du tableau */}
        {hasData && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} / {rows.length} produit{rows.length > 1 ? "s" : ""}
              {hasActiveFilters && <span className="ml-1 text-slate-400"> — filtres actifs</span>}
            </div>

            <div className="flex items-center gap-2">
              {/* ✅ Tri par quantité */}
              <button
                type="button"
                onClick={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? "none" : "asc"))
                }
                className={[
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  sortDir !== "none"
                    ? "border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-950/30",
                ].join(" ")}
                title="Trier par quantité"
              >
                Qté {sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : "↕"}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => { setQ(""); setAlertFilter("all"); setSortDir("none"); }}
                  className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contenu */}
        {!warehouseId ? (
          /* ✅ État vide guidé */
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {scope === "STORE" ? "Sélectionne un magasin" : "Sélectionne un entrepôt"}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Utilise le filtre ci-dessus pour choisir l'emplacement dont tu veux consulter le stock.
            </div>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucun produit en stock pour cet emplacement.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucun produit ne correspond aux filtres.{" "}
            <button
              type="button"
              onClick={() => { setQ(""); setAlertFilter("all"); }}
              className="underline underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Réinitialiser
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Unité</th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() =>
                      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? "none" : "asc"))
                    }
                    title="Cliquer pour trier"
                  >
                    Quantité {sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.product.id}
                    className={[
                      "border-t border-slate-200 dark:border-slate-800",
                      r.quantity <= 0
                        ? "bg-red-50/30 hover:bg-red-50/60 dark:bg-red-950/10 dark:hover:bg-red-950/20"
                        : r.quantity <= LOW_THRESHOLD
                        ? "bg-orange-50/30 hover:bg-orange-50/60 dark:bg-orange-950/10 dark:hover:bg-orange-950/20"
                        : "odd:bg-slate-50/40 hover:bg-slate-50 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {r.product.sku}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.product.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {r.product.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.product.unit}</td>
                    <td className="px-4 py-3 text-right">
                      <StockQty qty={r.quantity} />
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