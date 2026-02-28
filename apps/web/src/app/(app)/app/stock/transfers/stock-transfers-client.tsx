"use client";

import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { ProductPicker, type ProductPickerProduct } from "@/components/ProductPicker";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateSearchParams } from "@/lib/url";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  kind: "DEPOT" | "STORE";
};

// ✅ Labels français
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SHIPPED: "Expédié",
  PARTIALLY_RECEIVED: "Reçu partiellement",
  RECEIVED: "Reçu",
  CANCELLED: "Annulé",
};

const KIND_LABELS: Record<string, string> = {
  DEPOT: "Entrepôt",
  STORE: "Magasin",
};

function fmtDate(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return String(dt);
  }
}

function shortRef(id: string) {
  const s = String(id || "");
  return s.length <= 10 ? s : s.slice(0, 8);
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "").toUpperCase();
  const tone =
    s === "DRAFT" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
    : s === "SHIPPED" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    : s === "PARTIALLY_RECEIVED" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
    : s === "RECEIVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : s === "CANCELLED" ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  );
}

function formatStockError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "INSUFFICIENT_STOCK") {
      const d = e.details as Record<string, unknown> | undefined;
      const available = typeof d?.available === "number" ? d.available : null;
      const requested = typeof d?.requested === "number" ? d.requested : null;
      if (available !== null && requested !== null) {
        return `Stock insuffisant : disponible ${available}, demandé ${requested}.`;
      }
      return "Stock insuffisant.";
    }
    return e.message || `Erreur API (${e.status})`;
  }
  return (e as { message?: string })?.message ?? "Erreur lors du transfert";
}

type TransferLineRow = {
  productId: string;
  qty: number;
  note?: string | null;
  product?: { id: string; sku: string; name: string; unit?: string | null } | null;
};

type TransferRow = {
  id: string;
  createdAt: string;
  fromWarehouse: Warehouse;
  toWarehouse: Warehouse;
  note?: string | null;
  lines?: TransferLineRow[];
  product?: { id: string; sku: string; name: string; unit?: string | null } | null;
  qty?: number;
  status?: string;
  shippedAt?: string | null;
  receivedAt?: string | null;
};

// ============================================================
// Création d'un transfert
// ============================================================
export function StockTransfersNewClient() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductPickerProduct | null>(null);
  const [lineQty, setLineQty] = useState<string>("1");
  const [lineNote, setLineNote] = useState<string>("");

  const [lines, setLines] = useState<Array<{
    key: string;
    productId: string;
    qty: number;
    note?: string | null;
    product?: { id: string; sku: string; name: string; unit?: string | null } | null;
  }>>([]);

  const [fromKind, setFromKind] = useState<Warehouse["kind"]>("DEPOT");
  const [toKind, setToKind] = useState<Warehouse["kind"]>("STORE");
  const [allowStoreToStore, setAllowStoreToStore] = useState(false);

  // ✅ Note vide par défaut (pas de pré-remplissage)
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lineQtyInt = useMemo(() => {
    const n = Number(String(lineQty).replace(/\s/g, "").replace(/,/g, "."));
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(Math.abs(n));
  }, [lineQty]);

  const fromOptions = useMemo(() => warehouses.filter((w) => w.kind === fromKind), [warehouses, fromKind]);
  const toOptions = useMemo(() => warehouses.filter((w) => w.kind === toKind), [warehouses, toKind]);

  const fromSelected = useMemo(() => warehouses.find((w) => w.id === fromWarehouseId) ?? null, [warehouses, fromWarehouseId]);
  const toSelected = useMemo(() => warehouses.find((w) => w.id === toWarehouseId) ?? null, [warehouses, toWarehouseId]);

  const canSubmit =
    !!fromWarehouseId &&
    !!toWarehouseId &&
    fromWarehouseId !== toWarehouseId &&
    lines.length > 0 &&
    warehouses.some((w) => w.id === fromWarehouseId && w.kind === fromKind) &&
    warehouses.some((w) => w.id === toWarehouseId && w.kind === toKind) &&
    lines.every((l) => !!l.productId && l.qty > 0);

  // Ajuste toKind selon fromKind
  useEffect(() => {
    if (fromKind === "DEPOT") {
      setAllowStoreToStore(false);
      setToKind("STORE");
    } else {
      if (!allowStoreToStore) setToKind("DEPOT");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKind]);

  useEffect(() => {
    if (!fromWarehouseId) return;
    const ok = warehouses.some((w) => w.id === fromWarehouseId && w.kind === fromKind);
    if (!ok) setFromWarehouseId(warehouses.find((w) => w.kind === fromKind)?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKind, warehouses]);

  useEffect(() => {
    if (!toWarehouseId) return;
    const ok = warehouses.some((w) => w.id === toWarehouseId && w.kind === toKind);
    if (!ok) setToWarehouseId(warehouses.find((w) => w.kind === toKind && w.id !== fromWarehouseId)?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toKind, warehouses, fromWarehouseId]);

  // Batch stock source
  const uniqueLineProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lines) if (l.productId) ids.add(l.productId);
    if (selectedProduct?.id) ids.add(selectedProduct.id);
    return Array.from(ids);
  }, [lines, selectedProduct?.id]);

  const [batchQtyByProductId, setBatchQtyByProductId] = useState<Record<string, number>>({});
  const [batchQtyLoading, setBatchQtyLoading] = useState(false);
  const batchReqRef = useState({ id: 0 })[0];

  async function loadBatchQty() {
    if (!fromWarehouseId || uniqueLineProductIds.length === 0) {
      setBatchQtyByProductId({});
      return;
    }
    const reqId = ++batchReqRef.id;
    setBatchQtyLoading(true);
    try {
      const res = await apiPost<{ items: Array<{ productId: string; quantity: number }> }>("/stock/qty/batch", {
        warehouseId: fromWarehouseId,
        productIds: uniqueLineProductIds,
      });
      if (reqId !== batchReqRef.id) return;
      const map: Record<string, number> = {};
      for (const it of res.items ?? []) {
        if (it?.productId) map[String(it.productId)] = Number.isFinite(it.quantity) ? it.quantity : 0;
      }
      setBatchQtyByProductId(map);
    } catch {
      if (reqId !== batchReqRef.id) return;
      setBatchQtyByProductId({});
    } finally {
      if (reqId === batchReqRef.id) setBatchQtyLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { loadBatchQty(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWarehouseId, uniqueLineProductIds.join("|")]);

  async function loadWarehouses() {
    const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active&kind=all");
    const sorted = [...(res.items ?? [])].sort((a, b) => {
      const ak = a.kind === "DEPOT" ? 0 : 1;
      const bk = b.kind === "DEPOT" ? 0 : 1;
      if (ak !== bk) return ak - bk;
      return (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" });
    });
    setWarehouses(sorted);

    const firstDepot = sorted.find((w) => w.kind === "DEPOT");
    const firstStore = sorted.find((w) => w.kind === "STORE");
    if (!fromWarehouseId && firstDepot?.id) { setFromKind("DEPOT"); setFromWarehouseId(firstDepot.id); }
    if (!toWarehouseId && firstStore?.id) { setToKind("STORE"); setToWarehouseId(firstStore.id); }
  }

  useEffect(() => {
    loadWarehouses().catch(() => setWarehouses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setErr(null);
    const pid = String(selectedProduct?.id || "").trim();
    if (!pid || !selectedProduct) return setErr("Choisis un produit.");
    const q = lineQtyInt;
    if (!q) return setErr("Quantité invalide.");

    const available = batchQtyByProductId[pid];
    if (Number.isFinite(available) && q > available) {
      return setErr(`Stock insuffisant en source : disponible ${available}, demandé ${q}.`);
    }

    setLines((prev) => {
      const n = (lineNote || "").trim() || null;
      const idx = prev.findIndex((l) => l.productId === pid && (l.note ?? null) === n);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + q };
        return copy;
      }
      return [...prev, {
        key: `${pid}-${Date.now()}`,
        productId: pid,
        qty: q,
        note: n,
        product: { id: selectedProduct.id, sku: selectedProduct.sku, name: selectedProduct.name, unit: selectedProduct.unit ?? null },
      }];
    });

    setLineQty("1");
    setLineNote("");
    setSelectedProduct(null);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!fromWarehouseId) return setErr("Choisis la source.");
    if (!toWarehouseId) return setErr("Choisis la destination.");
    if (fromWarehouseId === toWarehouseId) return setErr("Source et destination doivent être différents.");
    if (!lines.length) return setErr("Ajoute au moins une ligne.");

    setSaving(true);
    try {
      const res = await apiPost<{ item: { id: string } }>("/stock/transfers", {
        fromWarehouseId,
        toWarehouseId,
        note: note.trim() || null,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, note: l.note ?? null })),
      });

      // ✅ Redirection vers le détail du transfert créé
      router.push(`/app/stock/transfers/${res.item.id}`);
    } catch (e: unknown) {
      setErr(formatStockError(e));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        {/* Itinéraire source → destination */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Source</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                value={fromKind}
                onChange={(e) => setFromKind(e.target.value as Warehouse["kind"])}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="DEPOT">Entrepôt</option>
                <option value="STORE">Magasin</option>
              </select>
              <select
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">— Choisir</option>
                {fromOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            {fromKind === "DEPOT" && (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Flux standard : Entrepôt → Magasin (réassort)</div>
            )}
            {fromKind === "STORE" && (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Flux inverse : Magasin → Entrepôt (retour stock)</div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Destination</label>

            {fromKind === "STORE" && (
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="allowStoreToStore"
                  type="checkbox"
                  checked={allowStoreToStore}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAllowStoreToStore(checked);
                    setToKind(checked ? "STORE" : "DEPOT");
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="allowStoreToStore" className="text-xs text-slate-600 dark:text-slate-300">
                  Magasin → Magasin (rare)
                </label>
              </div>
            )}

            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                value={toKind}
                onChange={(e) => {
                  const next = e.target.value as Warehouse["kind"];
                  setToKind(next);
                  if (fromKind === "STORE" && next === "STORE") setAllowStoreToStore(true);
                  if (fromKind === "STORE" && next === "DEPOT") setAllowStoreToStore(false);
                }}
                disabled={fromKind === "DEPOT"}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="DEPOT">Entrepôt</option>
                <option value="STORE">Magasin</option>
              </select>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">— Choisir</option>
                {toOptions.filter((w) => w.id !== fromWarehouseId).map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Motif global */}
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Motif (optionnel)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : réassort mensuel, retour stock…"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Ajout de lignes */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Produits à transférer</div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="grid gap-2 md:grid-cols-12 md:items-start">
              <div className="md:col-span-7">
                <ProductPicker
                  value={selectedProduct}
                  onChange={(p) => setSelectedProduct(p)}
                  disabled={!fromWarehouseId}
                  placeholder="Rechercher un produit (nom, SKU…)"
                  limit={30}
                  status="active"
                  showSku
                  showUnit={false}
                  variant="compact"
                  resultsMax={8}
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">Quantité</div>
                <input
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                  inputMode="numeric"
                  placeholder="1"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">&nbsp;</div>
                <button
                  type="button"
                  onClick={addLine}
                  disabled={!fromWarehouseId}
                  className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  Ajouter
                </button>
              </div>
            </div>

            {/* Stock source pour le produit sélectionné */}
            {selectedProduct && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Stock disponible (source) :{" "}
                {batchQtyLoading ? "…" :
                  Number.isFinite(batchQtyByProductId[selectedProduct.id])
                    ? <span className="font-medium text-slate-700 dark:text-slate-200">{batchQtyByProductId[selectedProduct.id]}</span>
                    : "—"
                }
              </div>
            )}

            <input
              value={lineNote}
              onChange={(e) => setLineNote(e.target.value)}
              placeholder="Motif de la ligne (optionnel)"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Tableau des lignes */}
        {lines.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/20 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2 text-right">Stock dispo</th>
                  <th className="px-3 py-2 text-right">Qté</th>
                  <th className="px-3 py-2">Motif</th>
                  <th className="px-3 py-2 text-right">Retirer</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = l.product;
                  const available = batchQtyByProductId[l.productId];
                  const hasAvail = Number.isFinite(available);
                  const insuff = hasAvail && l.qty > (available as number);
                  return (
                    <tr key={l.key} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p?.name ?? "—"}</div>
                        {p?.sku && <div className="text-xs text-slate-500 dark:text-slate-400">{p.sku}</div>}
                      </td>
                      <td className={`px-3 py-2 text-right ${insuff ? "text-red-600 dark:text-red-300" : ""}`}>
                        {hasAvail ? available : "—"}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${insuff ? "text-red-600 dark:text-red-300" : ""}`}>
                        {l.qty}
                        {insuff && <span className="ml-1 text-xs font-normal">⚠</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-sm">{l.note ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-slate-800 dark:hover:bg-red-950/20"
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Récap + CTA */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {fromSelected && toSelected ? (
              <span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{fromSelected.name}</span>
                {" → "}
                <span className="font-medium text-slate-700 dark:text-slate-200">{toSelected.name}</span>
                {lines.length > 0 && <span> · {lines.length} ligne{lines.length > 1 ? "s" : ""}</span>}
              </span>
            ) : (
              "Sélectionne la source et la destination."
            )}
          </div>

          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {/* ✅ Label CTA clair */}
            {saving ? "Création…" : "Créer le transfert"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </form>
    </div>
  );
}

// ============================================================
// Liste des transferts
// ============================================================
export function StockTransfersListClient({
  initialStatus = "ALL",
  initialScope = "ALL",
  initialWarehouseId = "ALL",
  initialQ = "",
}: {
  initialStatus?: string;
  initialScope?: string;
  initialWarehouseId?: string;
  initialQ?: string;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function replaceUrl(patch: Record<string, string>) {
    const nextUrl = updateSearchParams(pathname, searchParams, patch);
    router.replace(nextUrl);
  }

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [history, setHistory] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<string>(initialStatus);
  const [scope, setScope] = useState<string>(initialScope);
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId);
  const [q, setQ] = useState<string>(initialQ);

  useEffect(() => {
    const t = setTimeout(() => { replaceUrl({ q: q.trim() ? q : "" }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const hasAny = !!searchParams.get("status") || !!searchParams.get("scope") || !!searchParams.get("warehouseId") || !!searchParams.get("q");
    if (hasAny) return;
    const patch: Record<string, string> = {
      status: status !== "ALL" ? status : "",
      scope: scope !== "ALL" ? scope : "",
      warehouseId: warehouseId !== "ALL" ? warehouseId : "",
      q: q.trim() ? q : "",
    };
    if (patch.status || patch.scope || patch.warehouseId || patch.q) replaceUrl(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active&kind=all");
        setWarehouses(res.items ?? []);
      } catch {
        setWarehouses([]);
      }
    }
    fetchWarehouses();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: TransferRow[] }>("/stock/transfers?limit=100");
      setHistory(res.items ?? []);
    } catch (e: unknown) {
      setErr(formatStockError(e));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredHistory = useMemo(() => {
    let items = history;
    if (status !== "ALL") items = items.filter((t) => typeof t.status === "string" ? t.status === status : true);
    if (scope !== "ALL") items = items.filter((t) => t.fromWarehouse?.kind === scope || t.toWarehouse?.kind === scope);
    if (warehouseId !== "ALL") items = items.filter((t) => t.fromWarehouse?.id === warehouseId || t.toWarehouse?.id === warehouseId);
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      items = items.filter((t) => {
        const note = (t.note ?? "").toLowerCase();
        const from = `${t.fromWarehouse?.name ?? ""} ${t.fromWarehouse?.code ?? ""}`.toLowerCase();
        const to = `${t.toWarehouse?.name ?? ""} ${t.toWarehouse?.code ?? ""}`.toLowerCase();
        const firstLine = (t.lines ?? [])[0];
        const prod = firstLine?.product ?? t.product;
        return note.includes(ql) || from.includes(ql) || to.includes(ql) || (prod?.name ?? "").toLowerCase().includes(ql) || (prod?.sku ?? "").toLowerCase().includes(ql);
      });
    }
    return items;
  }, [history, status, scope, warehouseId, q]);

  const hasActiveFilters = status !== "ALL" || scope !== "ALL" || warehouseId !== "ALL" || q.trim();

  return (
    <div className="space-y-6">
      {/* Filtres dans une section dédiée */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-300">Statut</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); replaceUrl({ status: e.target.value === "ALL" ? "" : e.target.value }); }}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="DRAFT">Brouillon</option>
              <option value="SHIPPED">Expédié</option>
              <option value="PARTIALLY_RECEIVED">Reçu partiellement</option>
              <option value="RECEIVED">Reçu</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-300">Type</label>
            <select
              value={scope}
              onChange={(e) => { setScope(e.target.value); replaceUrl({ scope: e.target.value === "ALL" ? "" : e.target.value }); }}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ALL">Tous les types</option>
              <option value="DEPOT">Entrepôt</option>
              <option value="STORE">Magasin</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-300">Lieu</label>
            <select
              value={warehouseId}
              onChange={(e) => { setWarehouseId(e.target.value); replaceUrl({ warehouseId: e.target.value === "ALL" ? "" : e.target.value }); }}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ALL">Tous les lieux</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-300">Recherche</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Note, lieu, produit…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setStatus("ALL"); setScope("ALL"); setWarehouseId("ALL"); setQ("");
                replaceUrl({ status: "", scope: "", warehouseId: "", q: "" });
              }}
              className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="text-sm font-medium">
            {loading ? "Chargement…" : `${filteredHistory.length} transfert${filteredHistory.length > 1 ? "s" : ""}`}
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {err ? (
          <div className="p-4 text-sm text-red-700 dark:text-red-200">{err}</div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {hasActiveFilters ? "Aucun transfert pour ces critères." : "Aucun transfert."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Réf</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Créé</th>
                  {/* ✅ Tableau simplifié — source et destination sur une ligne */}
                  <th className="px-4 py-3">Trajet</th>
                  <th className="px-4 py-3">Produits</th>
                  <th className="px-4 py-3 text-right">Qté totale</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((t) => {
                  const firstLine = (t.lines ?? [])[0];
                  const prod = firstLine?.product ?? t.product;
                  const extraCount = (t.lines?.length ?? 0) > 1 ? ` +${(t.lines?.length ?? 0) - 1}` : "";
                  const qtyTotal = (t.lines ?? []).reduce((s, l) => s + (l.qty ?? 0), 0) || t.qty || 0;

                  return (
                    // ✅ Ligne entière cliquable
                    <tr
                      key={t.id}
                      className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-100 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/40"
                      onClick={() => router.push(`/app/stock/transfers/${t.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/stock/transfers/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs font-medium text-slate-700 hover:underline dark:text-slate-200"
                        >
                          {shortRef(t.id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status ?? ""} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {fmtDate(t.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <span className="font-medium">{t.fromWarehouse?.name}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-medium">{t.toWarehouse?.name}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          {KIND_LABELS[t.fromWarehouse?.kind ?? ""] ?? t.fromWarehouse?.kind} → {KIND_LABELS[t.toWarehouse?.kind ?? ""] ?? t.toWarehouse?.kind}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {prod?.name ?? "—"}
                        <span className="text-xs text-slate-400">{prod?.sku ? ` (${prod.sku})` : ""}{extraCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{qtyTotal}</td>
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

export default function StockTransfersClient() {
  return <StockTransfersListClient />;
}