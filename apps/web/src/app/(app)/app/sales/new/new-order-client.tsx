"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { ChevronRight, Info, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Warehouse = {
  id: string; name: string; code?: string | null;
  priceListId?: string | null; priceList?: { name: string } | null;
};
type Client = { id: string; name: string; phone?: string | null; paymentTermsDays?: number | null };
type Product = { id: string; sku: string; name: string; unit: string; price?: number | null };

type LineItem = {
  key: string; productId: string; qty: number; unitPrice: number | null;
};

type QuotePayload = {
  channel: "DEPOT"; warehouseId: string;
  clientId?: string | null; lines: { productId: string; qty: number; unitPrice?: number }[];
};
type QuoteResult = {
  lines: { productId: string; qty: number; unitPrice: number }[];
  totalHT: number; totalTTC: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n ?? 0);
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

const INPUT = "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20";
const LABEL = "block text-xs font-medium text-muted";

// ─── Composant ────────────────────────────────────────────────────────────────

export default function NewOrderClient() {
  const router = useRouter();

  // Référentiels
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Contexte commande
  const [warehouseId, setWarehouseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [note, setNote] = useState("");
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [shippingFee, setShippingFee] = useState<number>(0);

  // Saisie ligne
  const [qProduct, setQProduct] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [lines, setLines] = useState<LineItem[]>([]);

  // Quote
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const quoteSeq = useRef(0);
  const previewSeq = useRef(0);

  // Saving
  const [saving, setSaving] = useState(false);

  // ── Dérivés ─────────────────────────────────────────────────────────────────

  const selectedWarehouse = useMemo(() => warehouses.find(w => w.id === warehouseId) ?? null, [warehouses, warehouseId]);
  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) ?? null, [clients, clientId]);

  const noPriceList = !!warehouseId && !selectedWarehouse?.priceListId;

  const filteredProducts = useMemo(() => {
    const q = qProduct.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(q)).slice(0, 60);
  }, [products, qProduct]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const subtotal = useMemo(() => {
    if (typeof quoteTotal === "number") return quoteTotal;
    return lines.reduce((s, l) => s + l.qty * (l.unitPrice ?? 0), 0);
  }, [lines, quoteTotal]);

  const grandTotal = subtotal + (fulfillment === "DELIVERY" ? shippingFee : 0);

  const canSave = !loading && !saving && !quoteLoading && lines.length > 0 && !!warehouseId;

  // ── Quote ────────────────────────────────────────────────────────────────────

  async function runQuote(nextLines?: LineItem[]) {
    const cls = nextLines ?? lines;
    if (!cls.some(l => l.unitPrice == null)) { setQuoteTotal(null); return; }
    if (!warehouseId) return;

    const id = ++quoteSeq.current;
    setQuoteLoading(true); setErr(null);
    try {
      const payload: QuotePayload = {
        channel: "DEPOT", warehouseId,
        clientId: clientId || null,
        lines: cls.map(l => {
          const base: any = { productId: l.productId, qty: toInt(l.qty, 1) };
          if (l.unitPrice != null) base.unitPrice = toInt(l.unitPrice, 0);
          return base;
        }).filter(l => l.productId && l.qty > 0),
      };
      const res = await apiPost<QuoteResult>("/sales/quote", payload);
      if (id !== quoteSeq.current) return;
      const map = new Map(res.lines.map(l => [l.productId, l.unitPrice]));
      setLines(prev => prev.map(l => l.unitPrice != null ? l : { ...l, unitPrice: map.get(l.productId) ?? l.unitPrice }));
      setQuoteTotal(toInt(res.totalTTC ?? res.totalHT ?? 0));
    } catch (e) {
      if (id !== quoteSeq.current) return;
      setQuoteTotal(null); setErr(getErr(e));
    } finally {
      if (id === quoteSeq.current) setQuoteLoading(false);
    }
  }

  // Preview prix avant ajout ligne
  useEffect(() => {
    if (unitPrice != null) { setPreviewPrice(toInt(unitPrice, 0)); setPreviewLoading(false); return; }
    if (!selectedProductId || !warehouseId) { setPreviewPrice(null); return; }
    const id = ++previewSeq.current;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiPost<QuoteResult>("/sales/quote", {
          channel: "DEPOT", warehouseId, clientId: clientId || null,
          lines: [{ productId: selectedProductId, qty: Math.max(1, toInt(qty, 1)) }],
        });
        if (id !== previewSeq.current) return;
        const l = res.lines.find(x => x.productId === selectedProductId);
        setPreviewPrice(l ? toInt(l.unitPrice, 0) : null);
      } catch { if (id !== previewSeq.current) return; setPreviewPrice(null); }
      finally { if (id === previewSeq.current) setPreviewLoading(false); }
    }, 280);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, qty, unitPrice, warehouseId, clientId]);

  // Re-quote si le contexte tarifaire change
  useEffect(() => {
    if (lines.length && lines.some(l => l.unitPrice == null)) runQuote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, clientId]);

  // ── Chargement référentiels ───────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [wRes, cRes, pRes] = await Promise.all([
          apiGet<{ items: Warehouse[] }>("/warehouses?limit=200"),
          apiGet<{ items: Client[] }>("/clients?limit=500"),
          apiGet<{ items: Product[] }>("/products?limit=500"),
        ]);
        const whs = wRes.items ?? [];
        setWarehouses(whs);
        setClients(cRes.items ?? []);
        setProducts(pRes.items ?? []);
        if (whs[0]?.id) setWarehouseId(whs[0].id);
      } catch (e) { setErr(getErr(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  function addLine() {
    setErr(null);
    const pid = selectedProductId.trim();
    if (!pid) { setErr("Sélectionne un produit."); return; }
    const q = toInt(qty, 0);
    if (q <= 0) { setErr("Quantité doit être > 0."); return; }
    const pu = unitPrice == null ? null : toInt(unitPrice, 0);

    setLines(prev => {
      const idx = prev.findIndex(l => l.productId === pid);
      let next: LineItem[];
      if (idx >= 0) {
        next = prev.map((l, i) => i === idx ? { ...l, qty: l.qty + q } : l);
      } else {
        next = [...prev, { key: `${pid}-${Date.now()}`, productId: pid, qty: q, unitPrice: pu }];
      }
      queueMicrotask(() => runQuote(next));
      return next;
    });

    setQty(1); setSelectedProductId(""); setQProduct(""); setUnitPrice(null);
  }

  function removeLine(key: string) {
    setLines(prev => {
      const next = prev.filter(l => l.key !== key);
      queueMicrotask(() => runQuote(next));
      return next;
    });
  }

  function updateQty(key: string, newQty: number) {
    const q = Math.max(1, toInt(newQty, 1));
    setLines(prev => {
      const next = prev.map(l => l.key === key ? { ...l, qty: q } : l);
      queueMicrotask(() => runQuote(next));
      return next;
    });
  }

  async function saveOrder() {
    setSaving(true); setErr(null);
    try {
      if (!warehouseId) throw new Error("Entrepôt requis.");
      if (lines.some(l => l.unitPrice == null)) await runQuote();

      const cleanLines = lines
        .map(l => {
          const base: any = { productId: l.productId, qty: toInt(l.qty, 0) };
          if (l.unitPrice != null) base.unitPrice = toInt(l.unitPrice, 0);
          return base;
        })
        .filter(l => l.productId && l.qty > 0);

      if (!cleanLines.length) throw new Error("Ajoute au moins un produit.");

      const res = await apiPost<{ item: { id: string } }>("/sales", {
        channel: "DEPOT",
        warehouseId,
        clientId: clientId || null,
        note: note.trim() || null,
        fulfillment,
        shippingFee: fulfillment === "DELIVERY" ? shippingFee : 0,
        lines: cleanLines,
      });
      router.push(`/app/sales/${res.item.id}`);
    } catch (e) { setErr(getErr(e)); }
    finally { setSaving(false); }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/sales" className="hover:text-foreground hover:underline underline-offset-4">Commandes</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Nouvelle commande</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">Nouvelle commande client</h1>
        <p className="mt-0.5 text-sm text-muted">
          Commande B2B · Dépôt. La commande est enregistrée en <span className="font-medium text-foreground">brouillon</span> — valide-la pour déstocker et générer la facture.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">Chargement…</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">

          {/* ── Colonne gauche ── */}
          <div className="space-y-4 xl:col-span-1">

            {/* Contexte */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-foreground">Contexte de la commande</div>
              <div className="space-y-3">

                <div>
                  <label className={LABEL}>Entrepôt expéditeur</label>
                  <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={INPUT}>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>
                    ))}
                  </select>
                  {noPriceList && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Aucune grille tarifaire sur cet entrepôt — les prix ne seront pas calculés automatiquement.
                    </div>
                  )}
                  {selectedWarehouse?.priceList && (
                    <div className="mt-1 text-xs text-muted">
                      Tarif : <span className="font-medium text-foreground">{selectedWarehouse.priceList.name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className={LABEL}>Client</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} className={INPUT}>
                    <option value="">— Vente comptoir (sans client) —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {selectedClient?.paymentTermsDays && (
                    <div className="mt-1 text-xs text-muted">
                      Délai paiement : <span className="font-medium text-foreground">{selectedClient.paymentTermsDays} jours</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className={LABEL}>Mode de retrait</label>
                  <div className="mt-1 flex gap-2">
                    {(["PICKUP", "DELIVERY"] as const).map(m => (
                      <button key={m} type="button"
                        onClick={() => setFulfillment(m)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          fulfillment === m
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted hover:text-foreground"
                        }`}>
                        {m === "PICKUP" ? "Enlèvement" : "Livraison"}
                      </button>
                    ))}
                  </div>
                </div>

                {fulfillment === "DELIVERY" && (
                  <div>
                    <label className={LABEL}>Frais de livraison (XOF)</label>
                    <input type="number" min={0} value={shippingFee}
                      onChange={e => setShippingFee(toInt(e.target.value, 0))}
                      className={INPUT} />
                  </div>
                )}

                <div>
                  <label className={LABEL}>Note interne (optionnel)</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)}
                    rows={2} placeholder="Instruction de préparation, livraison…"
                    className={`${INPUT} resize-none`} />
                </div>
              </div>
            </div>

            {/* Ajout produit */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-foreground">Ajouter un produit</div>
              <div className="space-y-3">

                <div>
                  <label className={LABEL}>Recherche</label>
                  <input value={qProduct} onChange={e => setQProduct(e.target.value)}
                    placeholder="SKU, nom…" className={INPUT} />
                </div>

                <div>
                  <label className={LABEL}>Produit</label>
                  <select value={selectedProductId}
                    onChange={e => { setSelectedProductId(e.target.value); setUnitPrice(null); }}
                    className={INPUT}>
                    <option value="">— Sélectionner —</option>
                    {filteredProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Quantité</label>
                    <input type="number" min={1} value={qty}
                      onChange={e => setQty(toInt(e.target.value, 1))}
                      className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Prix unitaire</label>
                    <input type="number" min={0} value={unitPrice ?? ""}
                      onChange={e => setUnitPrice(e.target.value === "" ? null : toInt(e.target.value, 0))}
                      placeholder="Auto"
                      className={INPUT} />
                  </div>
                </div>

                {/* Preview prix */}
                {selectedProductId && unitPrice == null && (
                  <div className="rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Prix estimé (grille)</span>
                      <span>{qty} {productMap.get(selectedProductId)?.unit ?? "unités"}</span>
                    </div>
                    <div className="mt-1 text-sm font-bold text-foreground">
                      {previewLoading ? "Calcul…" : previewPrice == null ? "—" : formatXOF(previewPrice)}
                    </div>
                    {previewPrice != null && (
                      <div className="mt-0.5 text-xs text-muted">
                        Sous-total : {formatXOF(qty * previewPrice)}
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={addLine}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  + Ajouter au panier
                </button>
              </div>
            </div>
          </div>

          {/* ── Colonne droite — panier ── */}
          <div className="xl:col-span-2">
            <div className="rounded-xl border border-border bg-card shadow-sm">

              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 rounded-t-xl">
                <div className="text-sm font-semibold text-foreground">
                  Panier — {lines.length} ligne{lines.length !== 1 ? "s" : ""}
                </div>
                <div className="text-sm text-muted">
                  Total TTC :&nbsp;
                  <span className="font-bold text-foreground">{formatXOF(grandTotal)}</span>
                  {quoteLoading && <span className="ml-1.5 text-xs text-muted">(calcul…)</span>}
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
                  <div className="text-3xl opacity-20">📦</div>
                  <div className="text-sm text-muted">Aucun produit ajouté.</div>
                  <div className="text-xs text-muted">Utilise le formulaire à gauche.</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-foreground">
                      <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                        <tr>
                          <th className="px-4 py-3">Produit</th>
                          <th className="px-4 py-3 text-center w-28">Qté</th>
                          <th className="px-4 py-3 text-right">PU</th>
                          <th className="px-4 py-3 text-right">Total ligne</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map(l => {
                          const p = productMap.get(l.productId);
                          const pu = l.unitPrice ?? 0;
                          return (
                            <tr key={l.key}
                              className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_10%)]">
                              <td className="px-4 py-3">
                                <div className="font-medium">{p?.name ?? "—"}</div>
                                <div className="text-xs text-muted">{p?.sku}{p?.unit ? ` · ${p.unit}` : ""}</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input type="number" min={1} value={l.qty}
                                  onChange={e => updateQty(l.key, toInt(e.target.value, 1))}
                                  className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm text-foreground outline-none focus:ring focus:ring-primary/20" />
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {l.unitPrice == null
                                  ? <span className="text-xs text-muted">{quoteLoading ? "Calcul…" : "Auto"}</span>
                                  : formatXOF(pu)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums">
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

                  {/* Footer total + CTA */}
                  <div className="border-t border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-4 rounded-b-xl">
                    <div className="flex items-end justify-between gap-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-8">
                          <span className="text-muted w-32 text-right">Sous-total</span>
                          <span className="font-medium text-foreground tabular-nums">{formatXOF(subtotal)}</span>
                        </div>
                        {fulfillment === "DELIVERY" && shippingFee > 0 && (
                          <div className="flex items-center gap-8">
                            <span className="text-muted w-32 text-right">Frais livraison</span>
                            <span className="font-medium text-foreground tabular-nums">{formatXOF(shippingFee)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-8 border-t border-border pt-1.5">
                          <span className="text-muted w-32 text-right font-semibold">Total TTC</span>
                          <span className="text-lg font-bold text-foreground tabular-nums">{formatXOF(grandTotal)}</span>
                        </div>
                      </div>

                      <button type="button" disabled={!canSave} onClick={saveOrder}
                        className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                        {saving ? "Enregistrement…" : "Enregistrer le brouillon →"}
                      </button>
                    </div>

                    {err && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                        {err}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}