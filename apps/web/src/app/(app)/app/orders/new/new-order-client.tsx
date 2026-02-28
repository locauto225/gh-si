"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { ChevronRight, Info, Trash2, Search } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Warehouse = {
  id: string; name: string; code?: string | null;
  priceListId?: string | null; priceList?: { name: string } | null;
};
type Client = {
  id: string; name: string;
  phone?: string | null; paymentTermsDays?: number | null;
};
type Product = { id: string; sku: string; name: string; unit: string; price?: number | null };

type LineItem = { key: string; productId: string; qty: number; unitPrice: number | null };
type QuoteResult = {
  lines: { productId: string; qty: number; unitPrice: number }[];
  totalHT: number; totalTTC: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "XOF", maximumFractionDigits: 0,
  }).format(n ?? 0);
}
function toInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function getErr(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as any).message);
  return "Erreur";
}

const INPUT =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20";
const LABEL = "block text-xs font-medium text-muted mb-1";

// ─── Recherche produit inline ─────────────────────────────────────────────────

function ProductSearch({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (p: Product) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products
      .filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(s))
      .slice(0, 8);
  }, [products, q]);

  // Fermer si clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 focus-within:ring focus-within:ring-primary/20">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un produit (SKU, nom)…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-card shadow-lg divide-y divide-border">
          {results.map((p) => (
            <button
              key={p.id} type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(p);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
            >
              <div>
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="ml-2 text-xs text-muted">{p.sku}</span>
              </div>
              <span className="text-xs text-muted">{p.unit}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-card px-4 py-3 shadow-lg text-sm text-muted">
          Aucun produit trouvé.
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function NewOrderClient() {
  const router = useRouter();

  // Référentiels
  const [warehouses, setWarehouses]  = useState<Warehouse[]>([]);
  const [clients, setClients]        = useState<Client[]>([]);
  const [products, setProducts]      = useState<Product[]>([]);
  const [refLoading, setRefLoading]  = useState(true);

  // Contexte commande
  const [warehouseId, setWarehouseId]    = useState("");
  const [clientId, setClientId]          = useState("");
  const [note, setNote]                  = useState("");
  const [fulfillment, setFulfillment]    = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [shippingFee, setShippingFee]    = useState(0);

  // Lignes
  const [lines, setLines] = useState<LineItem[]>([]);

  // Quote
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteSeq = useRef(0);

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  // ── Dérivés ──────────────────────────────────────────────────────────────────

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId) ?? null,
    [warehouses, warehouseId]
  );
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const noPriceList = !!warehouseId && !selectedWarehouse?.priceListId;

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.qty * (l.unitPrice ?? 0), 0),
    [lines]
  );
  const grandTotal = subtotal + (fulfillment === "DELIVERY" ? shippingFee : 0);
  const canSave = !refLoading && !saving && !quoteLoading && lines.length > 0 && !!warehouseId;

  // ── Chargement référentiels ───────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setRefLoading(true);
      try {
        const [wRes, cRes, pRes] = await Promise.all([
          apiGet<{ items: Warehouse[] }>("/warehouses?limit=200"),
          apiGet<{ items: Client[] }>("/clients?limit=200"),
          apiGet<{ items: Product[] }>("/products?limit=200"),
        ]);
        const whs = wRes.items ?? [];
        setWarehouses(whs);
        setClients(cRes.items ?? []);
        setProducts(pRes.items ?? []);
        if (whs[0]?.id) setWarehouseId(whs[0].id);
      } catch (e) {
        setErr(getErr(e));
      } finally {
        setRefLoading(false);
      }
    })();
  }, []);

  // ── Quote (résolution des prix auto) ─────────────────────────────────────────

  async function runQuote(nextLines?: LineItem[]) {
    const cls = nextLines ?? lines;
    if (!cls.length || !warehouseId) return;

    const id = ++quoteSeq.current;
    setQuoteLoading(true);

    try {
      const res = await apiPost<QuoteResult>("/orders/quote", {
        warehouseId,
        clientId: clientId || null,
        lines: cls.map((l) => {
          const base: any = { productId: l.productId, qty: toInt(l.qty, 1) };
          if (l.unitPrice != null) base.unitPrice = toInt(l.unitPrice, 0);
          return base;
        }).filter((l) => l.productId && l.qty > 0),
      });

      if (id !== quoteSeq.current) return;

      const map = new Map(res.lines.map((l) => [l.productId, l.unitPrice]));
      setLines((prev) =>
        prev.map((l) => l.unitPrice != null ? l : { ...l, unitPrice: map.get(l.productId) ?? null })
      );
    } catch {
      // silencieux — prix restent null, sera re-tenté à la sauvegarde
    } finally {
      if (id === quoteSeq.current) setQuoteLoading(false);
    }
  }

  // Re-quote si le contexte tarifaire change
  useEffect(() => {
    if (lines.length) runQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, clientId]);

  // ── Gestion des lignes ───────────────────────────────────────────────────────

  function addProduct(p: Product) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      let next: LineItem[];
      if (idx >= 0) {
        // Incrémenter la quantité si déjà présent
        next = prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l);
      } else {
        next = [...prev, {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          qty: 1,
          unitPrice: p.price ?? null,
        }];
      }
      queueMicrotask(() => runQuote(next));
      return next;
    });
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLineQty(key: string, newQty: number) {
    setLines((prev) => {
      const next = prev.map((l) => l.key === key ? { ...l, qty: Math.max(1, toInt(newQty, 1)) } : l);
      queueMicrotask(() => runQuote(next));
      return next;
    });
  }

  function updateLinePrice(key: string, val: string) {
    setLines((prev) =>
      prev.map((l) => l.key === key
        ? { ...l, unitPrice: val === "" ? null : toInt(val, 0) }
        : l
      )
    );
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  async function saveOrder() {
    if (!warehouseId) { setErr("Sélectionne un entrepôt."); return; }
    if (!lines.length) { setErr("Ajoute au moins un produit."); return; }

    setSaving(true); setErr(null);

    try {
      // Résoudre les prix manquants avant d'envoyer
      if (lines.some((l) => l.unitPrice == null)) await runQuote();

      const cleanLines = lines
        .map((l) => {
          const base: any = { productId: l.productId, qty: toInt(l.qty, 0) };
          if (l.unitPrice != null) base.unitPrice = toInt(l.unitPrice, 0);
          return base;
        })
        .filter((l) => l.productId && l.qty > 0);

      if (!cleanLines.length) throw new Error("Ajoute au moins un produit valide.");

      const res = await apiPost<{ item: { id: string } }>("/orders", {
        warehouseId,
        clientId: clientId || null,
        note: note.trim() || null,
        fulfillment,
        shippingFee: fulfillment === "DELIVERY" ? shippingFee : 0,
        lines: cleanLines,
      });

      router.push(`/app/orders/${res.item.id}`);
    } catch (e) {
      setErr(getErr(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/orders" className="hover:text-foreground hover:underline underline-offset-4">
          Commandes
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Nouvelle commande</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">Nouvelle commande B2B</h1>
        <p className="mt-0.5 text-sm text-muted">
          La commande est enregistrée en brouillon. Tu pourras la confirmer depuis la fiche.
        </p>
      </div>

      {refLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          Chargement…
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── 1. Contexte ──────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">Contexte de la commande</div>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">

              {/* Entrepôt */}
              <div>
                <label className={LABEL}>Entrepôt expéditeur <span className="text-red-500">*</span></label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={INPUT}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.code ? ` (${w.code})` : ""}
                    </option>
                  ))}
                </select>
                {noPriceList && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Aucune grille tarifaire — les prix ne seront pas calculés automatiquement.
                  </div>
                )}
                {selectedWarehouse?.priceList && (
                  <div className="mt-1 text-xs text-muted">
                    Tarif : <span className="font-medium text-foreground">{selectedWarehouse.priceList.name}</span>
                  </div>
                )}
              </div>

              {/* Client */}
              <div>
                <label className={LABEL}>Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={INPUT}>
                  <option value="">— Sans client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {selectedClient?.paymentTermsDays && (
                  <div className="mt-1 text-xs text-muted">
                    Délai paiement : <span className="font-medium text-foreground">{selectedClient.paymentTermsDays} j</span>
                  </div>
                )}
              </div>

              {/* Mode livraison */}
              <div>
                <label className={LABEL}>Mode</label>
                <div className="flex gap-2">
                  {(["PICKUP", "DELIVERY"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setFulfillment(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        fulfillment === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted hover:text-foreground"
                      }`}>
                      {m === "PICKUP" ? "Enlèvement client" : "Livraison"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frais livraison */}
              {fulfillment === "DELIVERY" ? (
                <div>
                  <label className={LABEL}>Frais de livraison (XOF)</label>
                  <input type="number" min={0} value={shippingFee}
                    onChange={(e) => setShippingFee(toInt(e.target.value, 0))}
                    className={INPUT} />
                </div>
              ) : <div />}

              {/* Note */}
              <div className="sm:col-span-2">
                <label className={LABEL}>Note interne (optionnel)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  rows={2} placeholder="Instructions de préparation, livraison…"
                  className={`${INPUT} resize-none`} />
              </div>
            </div>
          </div>

          {/* ── 2. Lignes de commande ────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold text-foreground">
                Produits
                {lines.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    {lines.length} ligne{lines.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Recherche produit */}
            <div className="border-b border-border p-4">
              <ProductSearch products={products} onSelect={addProduct} />
              <p className="mt-2 text-xs text-muted">
                Tapez le nom ou le SKU pour rechercher. Le produit est ajouté directement à la liste ci-dessous.
              </p>
            </div>

            {/* Tableau des lignes */}
            {lines.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-3xl opacity-10 mb-2">📋</div>
                <div className="text-sm text-muted">Aucun produit ajouté.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]">
                    <tr>
                      <th className="px-4 py-3">Produit</th>
                      <th className="px-4 py-3 text-right w-28">Qté</th>
                      <th className="px-4 py-3 text-right w-36">Prix unit. (XOF)</th>
                      <th className="px-4 py-3 text-right w-32">Total ligne</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const p  = productMap.get(l.productId);
                      const pu = l.unitPrice ?? 0;
                      return (
                        <tr key={l.key}
                          className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_8%)]">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{p?.name ?? "—"}</div>
                            <div className="text-xs text-muted">{p?.sku} · {p?.unit}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min={1} value={l.qty}
                              onChange={(e) => updateLineQty(l.key, toInt(e.target.value, 1))}
                              className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-right text-sm text-foreground outline-none focus:ring focus:ring-primary/20"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min={0}
                              value={l.unitPrice ?? ""}
                              onChange={(e) => updateLinePrice(l.key, e.target.value)}
                              placeholder={quoteLoading ? "Calcul…" : "Auto"}
                              className="w-28 rounded-lg border border-border bg-card px-2 py-1.5 text-right text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                            {formatXOF(l.qty * pu)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => removeLine(l.key)}
                              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                              <Trash2 className="h-4 w-4" />
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
            {lines.length > 0 && (
              <div className="border-t border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-4 rounded-b-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                  {/* Totaux */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-36 text-muted">Sous-total HT</span>
                      <span className="font-medium text-foreground tabular-nums">{formatXOF(subtotal)}</span>
                    </div>
                    {fulfillment === "DELIVERY" && shippingFee > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="w-36 text-muted">Frais livraison</span>
                        <span className="font-medium text-foreground tabular-nums">{formatXOF(shippingFee)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 border-t border-border pt-1.5">
                      <span className="w-36 font-semibold text-foreground">Total TTC</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {formatXOF(grandTotal)}
                        {quoteLoading && <span className="ml-1.5 text-xs font-normal text-muted">calcul…</span>}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={saveOrder}
                    className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Création en cours…" : "Créer la commande →"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Erreur */}
          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {err}
            </div>
          )}

        </div>
      )}
    </div>
  );
}