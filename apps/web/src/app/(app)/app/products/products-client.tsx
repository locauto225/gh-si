"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiGet } from "@/lib/api";
import { useAsyncTask } from "@/hooks/use-async-task";

type Category = { id: string; name: string; slug: string };

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  purchasePrice?: number | null;
  bestSupplierUnitPrice?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  categoryId?: string | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "active" | "inactive" | "all";

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
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loadTask = useAsyncTask();
  const loading = !initialLoaded && loadTask.loading;
  const reloading = initialLoaded && loadTask.loading;

  const [status, setStatus] = useState<StatusFilter>("active");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  const [categories, setCategories] = useState<Category[]>([]);

  async function loadCategories() {
    try {
      // si ton endpoint /categories renvoie déjà { items: [...] }
      const res = await apiGet<{ items: Category[] }>("/categories?includeSubcategories=true");
      setCategories(res.items ?? []);
    } catch {
      // catégorie = filtre optionnel : on ne bloque pas
      setCategories([]);
    }
  }

  async function load() {
    setErr(null);
    try {
      const res = await loadTask.run(() => apiGet<{ items: Product[] }>(`/products?status=${status}`));
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du chargement"));
    }
    setInitialLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let noCat = 0;

    for (const p of items) {
      if (p.isActive) active++;
      else inactive++;
      if (!p.categoryId) noCat++;
    }
    return { active, inactive, noCat, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return items.filter((p) => {
      if (categoryId && (p.categoryId ?? "") !== categoryId) return false;

      if (!s) return true;

      const cat = (p.category?.name ?? "").toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        cat.includes(s)
      );
    });
  }, [items, q, categoryId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loadTask.loading}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] disabled:opacity-50"
        >
          {loadTask.loading ? "Actualisation…" : "Rafraîchir"}
        </button>

        <Link
          href="/app/products/new"
          className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          + Nouveau produit
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (nom, référence, catégorie…)"
          className="w-80 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring"
        >
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="all">Tous</option>
        </select>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="min-w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="ml-auto text-xs text-muted-foreground">
          {stats.active} actifs • {stats.inactive} inactifs • {stats.noCat} sans catégorie
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <div className="flex items-center justify-between gap-3">
            <span>{err}</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loadTask.loading}
              className="rounded-md border border-red-200/70 bg-white/70 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-white disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            >
              {loadTask.loading ? "Réessai…" : "Réessayer"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">
            {loading ? "Chargement…" : `${filtered.length} produit${filtered.length > 1 ? "s" : ""}`}
            </div>
            {reloading && (
              <div className="text-xs text-muted-foreground">Actualisation…</div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
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
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--foreground)_8%)] text-[11px] uppercase font-black text-muted">
                <tr>
                  <th className="px-4 py-2.5">Produit</th>
                  <th className="px-4 py-2.5">Catégorie</th>
                  <th className="px-4 py-2.5">Unité</th>
                  <th className="px-4 py-2.5 text-right">Prix d&apos;achat</th>
                  <th className="px-4 py-2.5">Dernière modif</th>
                  <th className="px-4 py-2.5">Statut</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/app/products/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/app/products/${p.id}`);
                      }
                    }}
                    className="border-t border-border cursor-pointer hover:bg-[color-mix(in_oklab,var(--card),var(--background)_25%)]"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 min-w-[220px]">
                        <div className="h-8 w-8 rounded-md border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] overflow-hidden flex items-center justify-center shrink-0">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-[10px] text-muted">—</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-medium leading-tight truncate">{p.name}</div>
                          <div className="font-mono text-[11px] text-foreground/70 truncate">{p.sku}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-2">
                      {p.category?.name ? (
                        <span className="inline-flex items-center rounded-full border border-border/70 bg-[color-mix(in_oklab,var(--card),var(--background)_18%)] px-2 py-0.5 text-[11px] text-muted">
                          {p.category.name}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2 text-sm text-foreground/75">{p.unit}</td>

                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {(() => {
                        const best = Math.trunc(Number(p.bestSupplierUnitPrice ?? 0));
                        const purchase = Math.trunc(Number(p.purchasePrice ?? 0));
                        const amount = best > 0 ? best : purchase > 0 ? purchase : null;
                        const source =
                          best > 0
                            ? "Fournisseur"
                            : purchase > 0
                              ? "Référence"
                              : null;

                        if (amount === null) return "—";

                        return (
                          <div className="grid justify-items-end gap-0.5">
                            <div className="font-semibold">{formatXOF(amount)}</div>
                            {source && (
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {source}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          p.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] text-muted"
                        }`}
                      >
                        {p.isActive ? "Actif" : "Inactif"}
                      </span>
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
