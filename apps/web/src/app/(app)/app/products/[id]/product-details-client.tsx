"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiGet } from "@/lib/api";
import { useAsyncTask } from "@/hooks/use-async-task";

type Category = { id: string; name: string; slug: string };
type Supplier = { id: string; name: string };
type Packaging = { id: string; name: string; units: number; barcode?: string | null };
type ProductSupplier = {
  id: string;
  supplierId: string;
  supplierSku?: string | null;
  lastUnitPrice?: number | null;
  supplier?: Supplier;
  packaging?: Packaging | null;
};

type SubCategory = { id: string; name: string; slug: string; categoryId?: string | null };

type ProductItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  purchasePrice?: number;
  isActive: boolean;
  categoryId?: string | null;
  category?: Category | null;
  imageUrl?: string | null;

  packagings?: Packaging[];
  suppliers?: ProductSupplier[];

  // selon ton API: `subCategories: [{ subCategory: {...}}]`
  subCategories?: { subCategory: SubCategory }[];

  createdAt: string;
  updatedAt: string;
};

function getErrMsg(e: unknown, fallback = "Erreur"): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductDetailsClient() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [item, setItem] = useState<ProductItem | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loadTask = useAsyncTask();
  const loading = !initialLoaded && loadTask.loading;
  const reloading = initialLoaded && loadTask.loading;

  async function load() {
    if (!id) return;
    setErr(null);
    try {
      const res = await loadTask.run(() => apiGet<{ item: ProductItem }>(`/products/${id}`));
      setItem(res.item);
      setNotFound(false);
    } catch (e) {
      setErr(getErrMsg(e, "Impossible de charger le produit"));
      if (e instanceof ApiError && e.status === 404) {
        setItem(null);
        setNotFound(true);
      }
    } finally {
      setInitialLoaded(true);
    }
  }

  useEffect(() => {
    setInitialLoaded(false);
    setNotFound(false);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const suppliers = item?.suppliers ?? [];
  const packagings = item?.packagings ?? [];

  // ✅ Option B: prix d’achat affiché = plus bas prix fournisseur (si dispo), sinon purchasePrice
  const lowestSupplierPrice = useMemo(() => {
    const prices = suppliers
      .map((s) => s.lastUnitPrice)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
      .map((v) => Math.trunc(v));

    if (!prices.length) return null;
    return Math.min(...prices);
  }, [suppliers]);

  const displayPurchasePrice = lowestSupplierPrice ?? Math.trunc(item?.purchasePrice ?? 0);
  const hasDisplayPurchasePrice = displayPurchasePrice > 0;
  const purchasePriceSource =
    !hasDisplayPurchasePrice
      ? "Aucun prix d'achat renseigné"
      : lowestSupplierPrice !== null
        ? "Meilleur prix fournisseur"
        : "Prix de référence produit";

  const subCategoryNames = useMemo(() => {
    const arr = (item?.subCategories ?? [])
      .map((x) => x?.subCategory?.name)
      .filter((x): x is string => Boolean(x));
    return arr;
  }, [item?.subCategories]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 px-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-end gap-2">
        {err && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loadTask.loading}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] disabled:opacity-50"
          >
            {loadTask.loading ? "Réessai…" : "Réessayer"}
          </button>
        )}
        {id && (
          <Link
            href={`/app/products/${id}/edit`}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
            title="Modifier"
          >
            Modifier
          </Link>
        )}
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* Loading / Empty */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          Chargement…
        </div>
      ) : !item && notFound ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          Produit introuvable.
        </div>
      ) : !item ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted space-y-3">
          <div>Impossible de charger le produit pour le moment.</div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loadTask.loading}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] disabled:opacity-50"
          >
            {loadTask.loading ? "Réessai…" : "Réessayer"}
          </button>
        </div>
      ) : (
        <>
          {reloading && (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              Actualisation…
            </div>
          )}
          {/* Summary card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] overflow-hidden flex items-center justify-center">
                {item.imageUrl ? (
                  <Link href={item.imageUrl} target="_blank" className="block w-full h-full" title="Ouvrir le visuel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </Link>
                ) : (
                  <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(80%_80%_at_50%_20%,color-mix(in_oklab,var(--primary),white_88%),transparent_70%),color-mix(in_oklab,var(--card),var(--background)_24%)]">
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklab,var(--foreground),transparent_95%)_45%,transparent_100%)]" />
                    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-1.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1-1.5h5L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
                          <circle cx="12" cy="12.5" r="3.2" />
                        </svg>
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Visuel indisponible
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mt-1 text-2xl font-semibold text-foreground break-words">
                  {item.name}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-2 py-0.5 text-xs font-mono text-foreground/80">
                    {item.sku}
                  </span>

                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      item.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] text-muted"
                    }`}
                  >
                    {item.isActive ? "Actif" : "Inactif"}
                  </span>

                  {item.category?.name ? (
                    <span className="inline-flex items-center rounded-full border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] px-2 py-0.5 text-xs text-muted">
                      {item.category.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sans catégorie</span>
                  )}
                </div>

                {subCategoryNames.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Sous-catégories :{" "}
                    <span className="text-foreground">{subCategoryNames.join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-auto sm:min-w-64 space-y-3">
                <div className="rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] p-4">
                  <div className="text-[11px] uppercase font-black text-muted-foreground">
                    Unité
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{item.unit}</div>
                </div>

                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <div className="text-[11px] uppercase font-black text-muted-foreground">
                    Prix d&apos;achat
                  </div>
                  <div className="mt-1 text-lg font-black text-primary">
                    {hasDisplayPurchasePrice ? formatXOF(displayPurchasePrice) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{purchasePriceSource}</div>
                </div>

              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Fournisseurs */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <div className="text-sm font-semibold text-foreground">Fournisseurs</div>
                <div className="text-xs text-muted-foreground">
                  Prix et références par fournisseur
                </div>
              </div>

              {suppliers.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Aucun fournisseur lié.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] text-[11px] uppercase font-black text-muted">
                      <tr>
                        <th className="px-4 py-2.5">Fournisseur</th>
                        <th className="px-4 py-2.5">Réf.</th>
                        <th className="px-4 py-2.5 text-right">Prix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => (
                        <tr
                          key={s.id}
                          className="border-t border-border hover:bg-[color-mix(in_oklab,var(--card),var(--background)_25%)]"
                        >
                          <td className="px-4 py-2">
                            {s.supplier?.name ?? "—"}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-foreground/80">
                            {s.supplierSku ? s.supplierSku : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {(() => {
                              const price = Math.trunc(Number(s.lastUnitPrice ?? 0));
                              return price > 0 ? formatXOF(price) : "—";
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Colisages */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <div className="text-sm font-semibold text-foreground">Colisages</div>
                <div className="text-xs text-muted-foreground">
                  Unités et formats disponibles
                </div>
              </div>

              {packagings.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Aucun colisage (vente à l’unité).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] text-[11px] uppercase font-black text-muted">
                      <tr>
                        <th className="px-4 py-2.5">Format</th>
                        <th className="px-4 py-2.5">Équivalence</th>
                        <th className="px-4 py-2.5">Code-barres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packagings.map((p) => (
                        <tr
                          key={p.id}
                          className="border-t border-border hover:bg-[color-mix(in_oklab,var(--card),var(--background)_25%)]"
                        >
                          <td className="px-4 py-2 font-medium">{p.name}</td>
                          <td className="px-4 py-2">
                            <span className="text-muted-foreground">1</span>{" "}
                            <span className="font-semibold text-foreground">{p.name}</span>{" "}
                            <span className="text-muted-foreground">=</span>{" "}
                            <span className="font-black text-primary tabular-nums">{p.units}</span>{" "}
                            <span className="text-foreground">
                              {item.unit}
                              {p.units > 1 ? "s" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-foreground/80">
                            {p.barcode ? p.barcode : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            Créé le{" "}
            <span className="text-foreground">
              {new Date(item.createdAt).toLocaleString("fr-FR")}
            </span>{" "}
            • Dernière mise à jour{" "}
            <span className="text-foreground">
              {new Date(item.updatedAt).toLocaleString("fr-FR")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
