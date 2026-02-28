"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type Warehouse = { id: string; code: string; name: string; isActive: boolean };
type Product = { id: string; sku: string; name: string; unit: string; isActive: boolean };

type MoveRow = {
  id: string;
  kind: "IN" | "OUT" | "ADJUST" | "TRANSFER";
  qtyDelta: number;
  refType?: string | null;
  note?: string | null;
  createdAt: string;
  product: Product;
};

type LossType = "BREAK" | "THEFT";

const LOSS_TYPE_LABELS: Record<LossType, string> = {
  BREAK: "Casse",
  THEFT: "Vol",
};

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

function formatApiError(e: unknown): string {
  if (e instanceof ApiError) return e.message || `Erreur API (${e.status})`;
  return (e as { message?: string })?.message ?? "Erreur";
}

function parseQtyPositiveInt(raw: string) {
  const s = String(raw ?? "").trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!s) return { ok: false as const, value: 0 };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false as const, value: 0 };
  const v = Math.trunc(n);
  if (v <= 0) return { ok: false as const, value: 0 };
  return { ok: true as const, value: v };
}

export default function StockLossesClient() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState<string>("");
  const [productId, setProductId] = useState<string>("");

  const [qty, setQty] = useState<string>("1");
  const [type, setType] = useState<LossType>("BREAK");
  const [note, setNote] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // ✅ Message de succès explicite
  const [success, setSuccess] = useState<string | null>(null);

  const [moves, setMoves] = useState<MoveRow[]>([]);

  const qtyValue = useMemo(() => {
    const parsed = parseQtyPositiveInt(qty);
    return parsed.ok ? parsed.value : 0;
  }, [qty]);

  // ✅ Filtrage produits par recherche — évite un select de 500 lignes à parcourir à la main
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  const noteTrimmed = note.trim();
  const noteOk = noteTrimmed.length >= 10;
  const canSubmit = !!warehouseId && !!productId && qtyValue > 0 && noteOk;

  async function loadWarehouses() {
    const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active");
    setWarehouses(res.items ?? []);
    // ✅ Pas d'auto-sélection silencieuse du premier item
  }

  async function loadProducts() {
    const res = await apiGet<{ items: Product[] }>("/products?status=active&limit=500");
    setProducts(res.items ?? []);
    // ✅ Pas d'auto-sélection silencieuse du premier item
  }

  async function loadLossHistory(wid: string) {
    if (!wid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: MoveRow[] }>(`/stock/moves?warehouseId=${wid}&limit=300`);
      setMoves((res.items ?? []).filter((m) => m.refType === "LOSS"));
    } catch (e: unknown) {
      setErr(formatApiError(e));
      setMoves([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses().catch(() => setWarehouses([]));
    loadProducts().catch(() => setProducts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (warehouseId) loadLossHistory(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    if (!warehouseId) return setErr("Choisis un entrepôt.");
    if (!productId) return setErr("Choisis un produit.");
    if (qtyValue <= 0) return setErr("La quantité doit être un entier supérieur à 0.");
    if (!noteOk) return setErr("La note est obligatoire (au moins 10 caractères).");

    setSaving(true);
    try {
      await apiPost("/stock/losses", {
        warehouseId,
        productId,
        qty: qtyValue,
        type,
        note: noteTrimmed,
      });

      // ✅ Succès explicite avec contexte
      setSuccess(
        `${LOSS_TYPE_LABELS[type]} enregistrée — ${qtyValue} unité${qtyValue > 1 ? "s" : ""} de "${selectedProduct?.name}" sorties du stock.`
      );

      setQty("1");
      setType("BREAK");
      setNote("");
      setProductId("");
      setProductSearch("");
      await loadLossHistory(warehouseId);
    } catch (e: unknown) {
      setErr(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Casse / Vol</div>
          <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Déclare une sortie de stock définitive. Chaque saisie est tracée pour audit.
          </div>
        </div>
        <Link
          href="/app/stock"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          ← Retour au stock
        </Link>
      </div>

      {/* Feedback succès */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Formulaire */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          ⚠️ À utiliser uniquement en cas de <span className="font-medium">casse</span> ou de{" "}
          <span className="font-medium">vol</span>. Une note claire est obligatoire pour l'audit.
        </div>

        <div className="grid gap-3 md:grid-cols-8">
          {/* Entrepôt */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Entrepôt <span className="text-red-500">*</span>
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">— Choisir</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* Produit — ✅ Recherche + select filtré */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Produit <span className="text-red-500">*</span>
            </label>
            <input
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setProductId("");
              }}
              placeholder="Rechercher par nom ou SKU…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              size={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              {filteredProducts.length === 0 ? (
                <option disabled value="">
                  {productSearch ? "Aucun résultat" : products.length === 0 ? "Chargement…" : "Tape pour filtrer"}
                </option>
              ) : (
                filteredProducts.slice(0, 50).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sku}
                  </option>
                ))
              )}
            </select>
            {selectedProduct && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ {selectedProduct.name} ({selectedProduct.sku})
                {selectedProduct.unit ? ` · ${selectedProduct.unit}` : ""}
              </div>
            )}
          </div>

          {/* Quantité */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Quantité <span className="text-red-500">*</span>
            </label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              placeholder="1"
              className={[
                "mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring",
                qtyValue <= 0 && qty !== ""
                  ? "border-red-300 focus:ring-red-200 dark:border-red-900/60"
                  : "border-slate-200 dark:border-slate-800",
                "dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500",
              ].join(" ")}
            />
            {/* ✅ Pas d'entité HTML &gt; */}
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Entier, supérieur à 0.
            </div>
          </div>

          {/* Type */}
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Type de perte
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LossType)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="BREAK">Casse</option>
              <option value="THEFT">Vol</option>
            </select>
          </div>

          {/* Note */}
          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Note <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-slate-400">(audit)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : carton tombé lors du déchargement, constaté par le responsable…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {/* ✅ Indicateur de progression */}
            <div
              className={`mt-1 text-xs ${
                noteTrimmed.length > 0 && !noteOk
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {noteTrimmed.length === 0
                ? "10 caractères minimum"
                : !noteOk
                ? `${10 - noteTrimmed.length} caractère${10 - noteTrimmed.length > 1 ? "s" : ""} manquant${10 - noteTrimmed.length > 1 ? "s" : ""}`
                : "✓"}
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          {/* ✅ Bouton désactivé si formulaire invalide + CTA clair */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? "Enregistrement…" : "Déclarer la perte"}
          </button>
        </div>
      </form>

      {/* Historique */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Historique des pertes
            {!warehouseId && (
              <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                — sélectionne un entrepôt
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => warehouseId && loadLossHistory(warehouseId)}
            disabled={!warehouseId || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : !warehouseId ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Choisis un entrepôt pour afficher l'historique.
          </div>
        ) : moves.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucune perte enregistrée pour cet entrepôt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Type</th>
                  {/* ✅ "Qté perdue" au lieu de "Delta" */}
                  <th className="px-4 py-3 text-right">Qté perdue</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => {
                  const lostQty = Math.abs(m.qtyDelta);
                  const detectedType: LossType | null =
                    m.note?.includes("THEFT") ? "THEFT"
                    : m.note?.includes("BREAK") ? "BREAK"
                    : null;

                  return (
                    <tr
                      key={m.id}
                      className="border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                        {fmtDate(m.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.product?.name ?? "—"}</div>
                        {m.product?.sku && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{m.product.sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {detectedType ? LOSS_TYPE_LABELS[detectedType] : "—"}
                      </td>
                      {/* ✅ Toujours en rouge — c'est une perte */}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                        −{lostQty}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {m.note ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}