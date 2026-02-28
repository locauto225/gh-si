"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";

export type ProductPickerProduct = {
  id: string;
  sku: string;
  name: string;
  unit?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string; slug?: string | null } | null;
};

type Category = { id: string; name: string; slug?: string | null };
type Variant = "panel" | "compact";

function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function getErrMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur";
}

export function ProductPicker({
  value,
  onChange,
  disabled,
  placeholder = "Saisir un nom, une référence…",
  autoFocus,
  limit = 30,
  status = "active",
  showSku = true,
  showUnit = true,
  categoryId: controlledCategoryId,
  onCategoryChange,
  localItems,
  variant = "panel",
  resultsMax = 8,
}: {
  value?: ProductPickerProduct | null;
  onChange: (p: ProductPickerProduct | null) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  limit?: number;
  status?: "active" | "all";
  showSku?: boolean;
  showUnit?: boolean;
  /** Pilotage externe du filtre catégorie */
  categoryId?: string | null;
  onCategoryChange?: (categoryId: string | null) => void;
  /** Liste locale optionnelle — filtrage côté client sans appel API */
  localItems?: ProductPickerProduct[];
  variant?: Variant;
  resultsMax?: number;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);

  const [internalCategoryId, setInternalCategoryId] = useState<string | null>(null);
  const categoryId =
    controlledCategoryId !== undefined ? controlledCategoryId : internalCategoryId;

  const [items, setItems] = useState<ProductPickerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reqRef = useRef({ id: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);

  // Chargement des catégories au montage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGet<{ items: Category[] }>("/categories");
        if (mounted) setCategories(res.items ?? []);
      } catch {
        if (mounted) setCategories([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fermeture de la dropdown compact au clic extérieur
  useEffect(() => {
    if (variant !== "compact") return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [variant]);

  // Fermeture de la dropdown au clavier (Escape)
  useEffect(() => {
    if (variant !== "compact") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [variant]);

  // Recherche principale — API ou filtrage local
  useEffect(() => {
    if (disabled) return;

    const run = async () => {
      const reqId = ++reqRef.current.id;
      setLoading(true);
      setErr(null);

      try {
        // Filtrage local si une liste est fournie
        if (Array.isArray(localItems) && localItems.length) {
          const filtered = filterLocal(localItems, qDebounced, categoryId, limit);
          if (reqId !== reqRef.current.id) return;
          setItems(filtered);
          return;
        }

        // Appel API standard
        const params = new URLSearchParams({ status });
        if (qDebounced.trim()) params.set("q", qDebounced.trim());
        if (categoryId) params.set("categoryId", categoryId);
        params.set("limit", String(Math.max(1, Math.min(200, limit))));

        const res = await apiGet<{ items: ProductPickerProduct[] }>(
          `/products?${params}`
        );
        if (reqId !== reqRef.current.id) return;
        setItems((res.items ?? []).slice(0, limit));
      } catch (e: unknown) {
        // Fallback : chargement sans filtres + filtrage local
        try {
          const res = await apiGet<{ items: ProductPickerProduct[] }>(
            `/products?status=${status}`
          );
          const normalized: ProductPickerProduct[] = (res.items ?? []).map((p) => ({
            id: String(p.id),
            sku: String(p.sku ?? ""),
            name: String(p.name ?? ""),
            unit: p.unit ?? null,
            categoryId: p.categoryId ?? p.category?.id ?? null,
            category: p.category ?? null,
          }));
          const filtered = filterLocal(normalized, qDebounced, categoryId, limit);
          if (reqRef.current.id !== reqId) return;
          setItems(filtered);
          setErr(null);
        } catch (e2: unknown) {
          if (reqRef.current.id !== reqId) return;
          setItems([]);
          setErr(getErrMsg(e2) || getErrMsg(e));
        }
      } finally {
        // ✅ Bug corrigé — était `reqRef.current.id === reqRef.current.id` (tautologie)
        if (reqRef.current.id === reqId) setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    qDebounced,
    categoryId,
    limit,
    status,
    disabled,
    Array.isArray(localItems) ? localItems.length : 0,
  ]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const sku = showSku && value.sku ? ` · ${value.sku}` : "";
    const unit = showUnit && value.unit ? ` · ${value.unit}` : "";
    return `${value.name}${sku}${unit}`;
  }, [value, showSku, showUnit]);

  function setCat(next: string | null) {
    if (controlledCategoryId === undefined) setInternalCategoryId(next);
    onCategoryChange?.(next);
  }

  // ─── Variant compact ───────────────────────────────────────────────────────
  if (variant === "compact") {
    const visibleItems = items.slice(0, Math.max(1, Math.min(20, resultsMax)));
    const showDropdown =
      open && !disabled && (loading || !!err || visibleItems.length > 0 || q.trim().length > 0);

    return (
      <div ref={wrapRef} className="space-y-2">
        <div className="grid gap-2 md:grid-cols-5">
          {/* Filtre catégorie */}
          <label className="md:col-span-2 block">
            <div className="text-xs text-slate-500 dark:text-slate-400">Catégorie</div>
            <select
              disabled={disabled}
              value={categoryId ?? ""}
              onChange={(e) => setCat(e.target.value || null)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
            >
              {/* ✅ Plus de tirets */}
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Champ de recherche + dropdown */}
          <label className="md:col-span-3 block relative">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">Recherche</div>
              {err && (
                <div className="text-[11px] text-red-600 dark:text-red-300">{err}</div>
              )}
            </div>
            <input
              ref={inputRef}
              disabled={disabled}
              autoFocus={autoFocus}
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
            />

            {showDropdown && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  {/* ✅ "…" correct */}
                  <span>
                    {loading ? "Recherche…" : `${visibleItems.length} résultat${visibleItems.length > 1 ? "s" : ""}`}
                  </span>
                  {value && (
                    <button
                      type="button"
                      onClick={() => onChange(null)}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      Retirer
                    </button>
                  )}
                </div>

                {visibleItems.length > 0 ? (
                  <ul className="max-h-56 overflow-auto">
                    {visibleItems.map((p) => {
                      const isSelected = !!value && value.id === p.id;
                      return (
                        <li
                          key={p.id}
                          className="border-t border-slate-100 first:border-t-0 dark:border-slate-800"
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => { onChange(p); setQ(""); setOpen(false); }}
                            className={[
                              "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-900/50",
                              isSelected ? "bg-slate-50 dark:bg-slate-900/50" : "",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {p.name}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {showSku && p.sku && (
                                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                    {p.sku}
                                  </span>
                                )}
                                {/* ✅ Indicateur visuel de sélection */}
                                {isSelected && (
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    ✓
                                  </span>
                                )}
                              </div>
                            </div>
                            {(p.category?.name || (showUnit && p.unit)) && (
                              <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                                {p.category?.name && `${p.category.name}`}
                                {showUnit && p.unit && ` · ${p.unit}`}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {loading ? "Recherche…" : "Aucun produit trouvé."}
                  </div>
                )}
              </div>
            )}
          </label>
        </div>

        {/* Résumé sélection */}
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <span className="text-xs text-slate-500 dark:text-slate-400">Sélectionné :</span>{" "}
          {/* ✅ "—" plutôt que la longue phrase */}
          <span className="font-medium">{selectedLabel ?? "—"}</span>
        </div>
      </div>
    );
  }

  // ─── Variant panel ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Catégorie + recherche */}
      <div className="grid gap-2 md:grid-cols-5">
        <label className="md:col-span-2 block">
          <div className="text-xs text-slate-500 dark:text-slate-400">Catégorie</div>
          <select
            disabled={disabled}
            value={categoryId ?? ""}
            onChange={(e) => setCat(e.target.value || null)}
            className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
          >
            {/* ✅ Plus de tirets */}
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-3 block">
          <div className="text-xs text-slate-500 dark:text-slate-400">Recherche</div>
          <input
            disabled={disabled}
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
          />
        </label>
      </div>

      {/* Sélection active */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200">
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Sélectionné :</span>{" "}
          <span className="font-medium">{selectedLabel ?? "—"}</span>
        </div>
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Retirer
          </button>
        )}
      </div>

      {/* Liste résultats */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {/* ✅ "…" correct */}
            {loading
              ? "Recherche…"
              : items.length > 0
                ? `${items.length} résultat${items.length > 1 ? "s" : ""}`
                : "Résultats"}
          </div>
          {err && (
            <div className="text-xs text-red-600 dark:text-red-300">{err}</div>
          )}
        </div>

        {items.length > 0 ? (
          <ul className="max-h-64 overflow-auto">
            {items.map((p) => {
              const isSelected = !!value && value.id === p.id;
              return (
                <li
                  key={p.id}
                  className="border-t border-slate-100 first:border-t-0 dark:border-slate-800"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(p)}
                    className={[
                      "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-900/50",
                      isSelected ? "bg-slate-50 dark:bg-slate-900/50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {showSku && p.sku && (
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {p.sku}
                          </span>
                        )}
                        {/* ✅ Indicateur visuel de sélection */}
                        {isSelected && (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                    {(p.category?.name || (showUnit && p.unit)) && (
                      <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {p.category?.name && `${p.category.name}`}
                        {showUnit && p.unit && ` · ${p.unit}`}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
            {loading ? "Recherche…" : "Aucun produit trouvé."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filtrage local ───────────────────────────────────────────────────────────

function filterLocal(
  list: ProductPickerProduct[],
  q: string,
  categoryId: string | null | undefined,
  limit: number
): ProductPickerProduct[] {
  const qq = (q || "").trim().toLowerCase();
  return list
    .filter((p) => {
      if (categoryId && (p.categoryId ?? p.category?.id ?? null) !== categoryId) return false;
      if (!qq) return true;
      return `${p.sku ?? ""} ${p.name ?? ""} ${p.unit ?? ""}`.toLowerCase().includes(qq);
    })
    .slice(0, Math.max(1, Math.min(200, limit)));
}