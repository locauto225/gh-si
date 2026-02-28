"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";

type Warehouse = { id: string; code: string; name: string; isActive: boolean };
type Product = { id: string; sku: string; name: string; unit: string; isActive: boolean };

type MoveRow = {
  id: string;
  kind: "IN" | "OUT" | "ADJUST" | "TRANSFER";
  qtyDelta: number;
  note?: string | null;
  refType?: string | null;
  refId?: string | null;
  createdAt: string;
  product: Product;
};

const MOTIF_PRESETS = [
  "Erreur de saisie",
  "Correction inventaire",
  "Correction technique",
  "Autre (à préciser)",
] as const;
type MotifPreset = (typeof MOTIF_PRESETS)[number];

const KIND_LABELS: Record<MoveRow["kind"], string> = {
  IN: "Entrée",
  OUT: "Sortie",
  TRANSFER: "Transfert",
  ADJUST: "Ajustement",
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

function formatStockError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "INSUFFICIENT_STOCK") {
      const d = e.details as { available?: number; requested?: number } | undefined;
      const available = typeof d?.available === "number" ? d.available : null;
      const requested = typeof d?.requested === "number" ? d.requested : null;
      if (available !== null && requested !== null) {
        return `Stock insuffisant : disponible ${available}, demandé ${requested}.`;
      }
      return "Stock insuffisant.";
    }
    return e.message || `Erreur API (${e.status})`;
  }
  return (e as { message?: string })?.message ?? "Erreur lors de la création du mouvement";
}

function parseQtySigned(raw: string) {
  const s = String(raw ?? "").trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!s) return { ok: false as const, value: 0 };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false as const, value: 0 };
  if (n === 0) return { ok: false as const, value: 0 };
  const abs = Math.trunc(Math.abs(n));
  if (abs === 0) return { ok: false as const, value: 0 };
  return { ok: true as const, value: (n < 0 ? -1 : 1) * abs };
}

export default function StockMovesClient() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState<string>("");
  const [productId, setProductId] = useState<string>("");

  const [qty, setQty] = useState<string>("");

  // ✅ Mode motif simplifié — plus de toggle confus, une seule interface
  const [motifPreset, setMotifPreset] = useState<MotifPreset | "">("");
  const [customNote, setCustomNote] = useState<string>("");

  const isCustom = motifPreset === "Autre (à préciser)";
  // La note finale envoyée à l'API
  const finalNote = isCustom ? customNote.trim() : (motifPreset || "");

  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // ✅ Message de succès
  const [success, setSuccess] = useState<string | null>(null);

  const qtyDelta = useMemo(() => {
    const parsed = parseQtySigned(qty);
    return parsed.ok ? parsed.value : 0;
  }, [qty]);

  // ✅ Filtrage produits côté client
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  const motifOk = isCustom ? customNote.trim().length >= 3 : !!motifPreset;

  // ✅ Désactivation complète si formulaire invalide
  const canSubmit = !!warehouseId && !!productId && qtyDelta !== 0 && motifOk;

  async function loadWarehouses() {
    const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active");
    setWarehouses(res.items ?? []);
    // ✅ Pas d'auto-sélection silencieuse
  }

  async function loadProducts() {
    const res = await apiGet<{ items: Product[] }>("/products?status=active&limit=500");
    setProducts(res.items ?? []);
    // ✅ Pas d'auto-sélection silencieuse
  }

  async function loadMoves(wid: string) {
    if (!wid) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: MoveRow[] }>(
        `/stock/moves?warehouseId=${wid}&kind=ADJUST&limit=100`
      );
      setMoves(res.items ?? []);
    } catch (e: unknown) {
      setErr(formatStockError(e));
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
    if (warehouseId) loadMoves(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    if (!warehouseId) return setErr("Choisis un entrepôt.");
    if (!productId) return setErr("Choisis un produit.");
    if (qtyDelta === 0) return setErr("Saisis une quantité signée non nulle (+3 pour ajouter, -2 pour retirer).");
    if (!motifPreset) return setErr("Choisis un motif.");
    if (isCustom && customNote.trim().length < 3) {
      return setErr("Décris le motif (au moins 3 caractères).");
    }

    setSaving(true);
    try {
      await apiPost("/stock/moves", {
        kind: "ADJUST",
        warehouseId,
        productId,
        qtyDelta,
        note: finalNote || null,
      });

      // ✅ Succès explicite avec signe et contexte
      const sign = qtyDelta > 0 ? `+${qtyDelta}` : String(qtyDelta);
      setSuccess(
        `Ajustement enregistré — ${sign} unité${Math.abs(qtyDelta) > 1 ? "s" : ""} sur "${selectedProduct?.name}" · Motif : ${finalNote}.`
      );

      setQty("");
      setMotifPreset("");
      setCustomNote("");
      setProductId("");
      setProductSearch("");
      await loadMoves(warehouseId);
    } catch (e: unknown) {
      setErr(formatStockError(e));
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

      {/* Formulaire */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Ajustement manuel
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200">
          Réservé aux <span className="font-medium">corrections manuelles</span>. Saisis une quantité signée :
          {" "}<span className="font-medium">+3</span> pour ajouter, <span className="font-medium">-2</span> pour retirer.
          Chaque correction est tracée pour audit.
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

          {/* Quantité signée */}
          <div className="md:col-span-2">
            {/* ✅ Label métier, pas "Delta (signé)" */}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Quantité <span className="text-red-500">*</span>
            </label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="text"
              placeholder="+3 ou -2"
              className={[
                "mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring font-mono",
                qty !== "" && qtyDelta === 0
                  ? "border-red-300 focus:ring-red-200 dark:border-red-900/60"
                  : qtyDelta !== 0
                  ? qtyDelta > 0
                    ? "border-emerald-300 focus:ring-emerald-100 dark:border-emerald-900/60"
                    : "border-red-300 focus:ring-red-100 dark:border-red-900/60"
                  : "border-slate-200 dark:border-slate-800",
                "dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500",
              ].join(" ")}
            />
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {qtyDelta > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">+{qtyDelta} — ajout</span>
              ) : qtyDelta < 0 ? (
                <span className="text-red-600 dark:text-red-400">{qtyDelta} — retrait</span>
              ) : (
                "Entier signé, non nul."
              )}
            </div>
          </div>

          {/* Motif — ✅ Interface unifiée : select preset + champ libre conditionnel */}
          <div className="md:col-span-8">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Motif <span className="text-red-500">*</span>
            </label>
            <select
              value={motifPreset}
              onChange={(e) => {
                setMotifPreset(e.target.value as MotifPreset | "");
                setCustomNote("");
              }}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">— Choisir un motif</option>
              {MOTIF_PRESETS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* ✅ Champ libre visible uniquement si "Autre" — plus de toggle confus */}
            {isCustom && (
              <div className="mt-2">
                <input
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Décris la correction (ex : anomalie sur facture #1234, constatée le…)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <div className={`mt-1 text-xs ${customNote.trim().length > 0 && customNote.trim().length < 3 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}>
                  {customNote.trim().length === 0
                    ? "3 caractères minimum"
                    : customNote.trim().length < 3
                    ? `${3 - customNote.trim().length} caractère${3 - customNote.trim().length > 1 ? "s" : ""} manquant${3 - customNote.trim().length > 1 ? "s" : ""}`
                    : "✓"}
                </div>
              </div>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          {/* ✅ Bouton désactivé si invalide + CTA clair */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? "Enregistrement…" : "Enregistrer l'ajustement"}
          </button>
        </div>
      </form>

      {/* Historique */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Historique des ajustements
            {!warehouseId && (
              <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                — sélectionne un entrepôt
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => warehouseId && loadMoves(warehouseId)}
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
            Aucun ajustement pour cet entrepôt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Produit</th>
                  {/* ✅ "Correction" au lieu de "Delta" */}
                  <th className="px-4 py-3 text-right">Correction</th>
                  <th className="px-4 py-3">Motif</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => {
                  const isPositive = m.qtyDelta > 0;
                  const deltaDisplay = isPositive ? `+${m.qtyDelta}` : String(m.qtyDelta);
                  const deltaCls = isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400";

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
                      {/* ✅ Couleur selon signe */}
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${deltaCls}`}>
                        {deltaDisplay}
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