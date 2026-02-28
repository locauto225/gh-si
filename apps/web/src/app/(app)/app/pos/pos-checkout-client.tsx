"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { Search, Trash2, X, Check, ChevronLeft, Package } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Store = { id: string; code: string; name: string; warehouseId: string; priceListId?: string | null };
type Client = { id: string; name: string; phone?: string | null };
type Product = { id: string; sku: string; name: string; unit: string; price?: number | null };

type CartLine = { key: string; productId: string; qty: number; unitPrice: number };

type PaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "OTHER";
const PM_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces", MOBILE_MONEY: "Mobile Money", CARD: "Carte", OTHER: "Autre",
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

// ─── Sous-composant : sélecteur de magasin ────────────────────────────────────

function StorePicker({ stores, onPick }: { stores: Store[]; onPick: (s: Store) => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-center">
        <div className="mb-3 text-4xl">🏪</div>
        <h1 className="text-2xl font-bold text-foreground">Sélectionner un magasin</h1>
        <p className="mt-1 text-sm text-muted">Choisissez le point de vente pour ouvrir la caisse.</p>
      </div>
      <div className="grid w-full max-w-lg gap-3">
        {stores.map(s => (
          <button key={s.id} type="button" onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm hover:border-primary hover:bg-[color-mix(in_oklab,var(--card),var(--primary)_5%)] transition-colors group">
            <div className="font-bold text-foreground group-hover:text-primary">{s.name}</div>
            <div className="mt-0.5 text-xs text-muted">{s.code}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sous-composant : modal paiement ──────────────────────────────────────────

function PaymentModal({
  total, clientId, onConfirm, onCancel, paying,
}: {
  total: number;
  clientId: string;
  onConfirm: (method: PaymentMethod, amountPaid: number, reference: string | null) => void;
  onCancel: () => void;
  paying: boolean;
}) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountStr, setAmountStr] = useState(String(total));
  const [reference, setReference] = useState("");
  const amountPaid = toInt(amountStr, 0);
  const rendu = Math.max(0, amountPaid - total);
  const manquant = Math.max(0, total - amountPaid);
  const canPay = amountPaid >= total || clientId !== ""; // crédit client autorisé
  const needsReference = method === "MOBILE_MONEY" || method === "CARD";

  // Numpad rapide
  const presets = [total, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">Encaissement</div>
            <div className="text-2xl font-bold text-foreground tabular-nums">{formatXOF(total)}</div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-muted hover:bg-[color-mix(in_oklab,var(--card),var(--background)_40%)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Mode de paiement */}
          <div>
            <div className="text-xs font-semibold text-muted mb-2">Mode de paiement</div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PM_LABELS) as PaymentMethod[]).map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                    method === m
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-foreground hover:border-primary/40"
                  }`}>
                  {PM_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Référence transaction (optionnel) */}
          {needsReference && (
            <div>
              <div className="text-xs font-semibold text-muted mb-2">Référence transaction (optionnel)</div>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder={method === "MOBILE_MONEY" ? "Réf. Mobile Money" : "Réf. carte"}
                className="w-full rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Montant reçu */}
          <div>
            <div className="text-xs font-semibold text-muted mb-2">Montant reçu (XOF)</div>
            <input
              type="number" min={0} value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className="w-full rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-3 text-xl font-bold text-foreground tabular-nums outline-none focus:ring-2 focus:ring-primary/30"
            />
            {/* Suggestions */}
            <div className="mt-2 flex gap-2">
              {presets.map(v => (
                <button key={v} type="button" onClick={() => setAmountStr(String(v))}
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:border-primary/40">
                  {formatXOF(v)}
                </button>
              ))}
            </div>
          </div>

          {/* Récap rendu / manquant */}
          <div className={`rounded-xl border px-4 py-3 ${
            rendu > 0
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
              : manquant > 0
              ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
              : "border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]"
          }`}>
            {rendu > 0 ? (
              <div>
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Rendu monnaie</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{formatXOF(rendu)}</div>
              </div>
            ) : manquant > 0 ? (
              <div>
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Manque</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 tabular-nums">{formatXOF(manquant)}</div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-muted">Montant exact ✓</div>
            )}
          </div>

          {/* Bouton valider */}
          <button type="button"
            disabled={!canPay || paying || amountPaid === 0}
            onClick={() => onConfirm(method, amountPaid, reference.trim() ? reference.trim() : null)}
            className="w-full rounded-xl bg-primary py-4 text-base font-black text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
            {paying ? "Validation…" : "✓ Valider l'encaissement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PosCheckoutClient({ storeId }: { storeId?: string }) {
  const router = useRouter();

  // Référentiels
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Session caisse
  const [store, setStore] = useState<Store | null>(null);
  const [clientId, setClientId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");

  // Recherche produit
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Paiement
  const [showPayment, setShowPayment] = useState(false);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Quote pour prix auto
  const [quotePending, setQuotePending] = useState(false);
  const quoteSeq = useRef(0);

  // ── Chargement ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sRes, pRes, cRes] = await Promise.all([
          apiGet<{ items: Store[] }>("/stores?limit=200"),
          apiGet<{ items: Product[] }>("/products?limit=200"),
          apiGet<{ items: Client[] }>("/clients?limit=200"),
        ]);
        const storeList = sRes.items ?? [];
        setStores(storeList);
        setProducts(pRes.items ?? []);
        setClients(cRes.items ?? []);

        // Auto-sélection si storeId passé en prop
        if (storeId) {
          const found = storeList.find(s => s.id === storeId);
          if (found) setStore(found);
        }
      } catch (e) { setErr(getErr(e)); }
      finally { setLoading(false); }
    })();
  }, [storeId]);

  // ── Dérivés ─────────────────────────────────────────────────────────────────

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const filteredProducts = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return products.slice(0, 48);
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query)
    ).slice(0, 48);
  }, [products, q]);

  const total = useMemo(() => cart.reduce((s, l) => s + l.qty * l.unitPrice, 0), [cart]);
  const lineCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  // ── Actions panier ───────────────────────────────────────────────────────────

  async function addToCart(product: Product) {
    // Prix connu sur le produit : on l'utilise directement
    const knownPrice = product.price != null ? toInt(product.price, 0) : null;

    setCart(prev => {
      const idx = prev.findIndex(l => l.productId === product.id);
      if (idx >= 0) {
        return prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, {
        key: `${product.id}-${Date.now()}`,
        productId: product.id,
        qty: 1,
        unitPrice: knownPrice ?? 0,
      }];
    });

    // Si pas de prix connu, fetch depuis quote
    if (knownPrice == null && store) {
      const id = ++quoteSeq.current;
      setQuotePending(true);
      try {
        const res = await apiPost<any>("/sales/quote", {
          channel: "STORE", warehouseId: store.warehouseId,
          storeId: store.id,
          clientId: clientId || null,
          lines: [{ productId: product.id, qty: 1 }],
        });
        if (id !== quoteSeq.current) return;
        const line = (res.lines ?? []).find((l: any) => l.productId === product.id);
        if (line?.unitPrice != null) {
          setCart(prev => prev.map(l =>
            l.productId === product.id && l.unitPrice === 0
              ? { ...l, unitPrice: toInt(line.unitPrice, 0) }
              : l
          ));
        }
      } catch { /* silencieux */ }
      finally { if (id === quoteSeq.current) setQuotePending(false); }
    }
  }

  function removeFromCart(key: string) {
    setCart(prev => prev.filter(l => l.key !== key));
  }

  function updateQty(key: string, newQty: number) {
    const q = Math.max(1, toInt(newQty, 1));
    setCart(prev => prev.map(l => l.key === key ? { ...l, qty: q } : l));
  }

  function clearCart() {
    setCart([]);
    setClientId("");
    setNote("");
    setErr(null);
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  // ── Paiement ─────────────────────────────────────────────────────────────────

  async function handlePayment(method: PaymentMethod, amountPaid: number, reference: string | null) {
    if (!store) return;
    setPaying(true);
    setErr(null);

    try {
      // 1) Créer la vente (DRAFT)
      const created = await apiPost<{ item: { id: string } }>("/sales", {
        channel: "STORE",
        warehouseId: store.warehouseId,
        storeId: store.id,
        clientId: clientId || null,
        note: note.trim() || null,
        fulfillment: "PICKUP",
        shippingFee: 0,
        lines: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
        // ⚠️ Paiement : géré plus tard via un endpoint dédié /payments.
        // Ici on se limite à la validation de la vente pour générer le ticket.
      });

      const saleId = created.item.id;

      // 2) Enregistrer le paiement (source of truth)
      // On enregistre le montant APPLIQUÉ à la vente (et non le montant reçu) :
      // - si le client donne plus, la différence est un rendu monnaie
      // - si le client donne moins, c'est un paiement partiel
      const appliedAmount = Math.min(Math.max(0, amountPaid), total);

      await apiPost(`/sales/${saleId}/payments`, {
        method,
        amount: appliedAmount,
        reference,
        receivedAt: new Date().toISOString(),
      });

      // 3) Valider la vente (POSTED) => déstocke + génère le ticket POS
      const posted = await apiPatch<{
        item: { id: string };
        invoice?: { id: string; number: string; status: string } | null;
        posReceipt?: { id: string; number: string; issuedAt?: string | null } | null;
      }>(`/sales/${saleId}/status`, { status: "POSTED" });

      setShowPayment(false);
      setSuccess(true);

      // 4) Redirection vers le ticket (si dispo)
      const receiptId = posted.posReceipt?.id;
      setTimeout(() => {
        if (receiptId) {
          router.push(`/app/pos/receipts/${receiptId}`);
        } else {
          router.push(`/app/pos/receipts?storeId=${store.id}`);
        }
      }, 800);
    } catch (e) {
      setErr(getErr(e));
      setShowPayment(false);
    } finally {
      setPaying(false);
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted">Chargement de la caisse…</div>
      </div>
    );
  }

  if (!store) {
    return <StorePicker stores={stores} onPick={setStore} />;
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
          <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">Vente enregistrée !</div>
          <div className="mt-1 text-sm text-muted">Redirection vers les tickets…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showPayment && (
        <PaymentModal
          total={total}
          clientId={clientId}
          onConfirm={handlePayment}
          onCancel={() => setShowPayment(false)}
          paying={paying}
        />
      )}

      {/* Layout plein écran 2 colonnes */}
      <div className="flex h-screen overflow-hidden bg-background text-foreground">

        {/* ── Panneau gauche — produits ── */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-border">

          {/* Barre top magasin */}
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shrink-0">
            <button type="button"
              onClick={() => setStore(null)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" />
              Changer
            </button>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-foreground">{store.name}</span>
              <span className="ml-2 text-xs text-muted">{store.code}</span>
            </div>
            {/* Client */}
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="max-w-[200px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring">
              <option value="">Client comptoir</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Barre de recherche */}
          <div className="border-b border-border bg-card px-4 py-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                ref={searchRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Rechercher un produit (SKU, nom)…"
                autoFocus
                className="w-full rounded-xl border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
              />
              {q && (
                <button type="button" onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Grille produits */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Package className="h-8 w-8 text-muted opacity-40" />
                <div className="text-sm text-muted">Aucun produit trouvé.</div>
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map(p => {
                  const inCart = cart.find(l => l.productId === p.id);
                  const price = p.price != null ? toInt(p.price, 0) : null;
                  return (
                    <button key={p.id} type="button" onClick={() => addToCart(p)}
                      className={`relative rounded-xl border p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        inCart
                          ? "border-primary bg-[color-mix(in_oklab,var(--card),var(--primary)_8%)] shadow-md"
                          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                      }`}>
                      {inCart && (
                        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground shadow">
                          {inCart.qty}
                        </div>
                      )}
                      <div className="font-semibold text-xs text-foreground leading-tight line-clamp-2 mb-1.5">{p.name}</div>
                      <div className="text-[10px] text-muted font-medium">{p.sku} · {p.unit}</div>
                      {price != null && price > 0 && (
                        <div className="mt-1.5 text-sm font-bold text-primary tabular-nums">{formatXOF(price)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau droit — panier ── */}
        <div className="flex w-80 xl:w-96 shrink-0 flex-col bg-card overflow-hidden">

          {/* Header panier */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
            <div className="text-sm font-bold text-foreground">
              Panier&nbsp;
              {lineCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-black text-primary-foreground">
                  {lineCount}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button type="button" onClick={clearCart}
                className="flex items-center gap-1 text-xs text-muted hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" /> Vider
              </button>
            )}
          </div>

          {/* Lignes du panier */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
                <div className="text-4xl opacity-20">🛒</div>
                <div className="text-sm text-muted">Panier vide</div>
                <div className="text-xs text-muted">Sélectionne des produits à gauche.</div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map(l => {
                  const p = productMap.get(l.productId);
                  return (
                    <div key={l.key} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground leading-tight">{p?.name ?? "—"}</div>
                        <div className="text-xs text-muted mt-0.5">{formatXOF(l.unitPrice)} / {p?.unit ?? "u"}</div>
                      </div>
                      {/* Contrôle quantité */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button"
                          onClick={() => l.qty > 1 ? updateQty(l.key, l.qty - 1) : removeFromCart(l.key)}
                          className="h-7 w-7 rounded-lg border border-border text-sm font-bold text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 flex items-center justify-center">
                          {l.qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : "−"}
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums text-foreground">{l.qty}</span>
                        <button type="button"
                          onClick={() => updateQty(l.key, l.qty + 1)}
                          className="h-7 w-7 rounded-lg border border-border text-sm font-bold text-muted hover:border-primary/40 hover:bg-[color-mix(in_oklab,var(--card),var(--primary)_8%)] hover:text-primary flex items-center justify-center">
                          +
                        </button>
                      </div>
                      {/* Total ligne */}
                      <div className="w-20 text-right text-sm font-bold tabular-nums text-foreground shrink-0">
                        {formatXOF(l.qty * l.unitPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Note */}
          {cart.length > 0 && (
            <div className="border-t border-border px-4 py-3 shrink-0">
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="Note (optionnel)…"
                className="w-full rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_25%)] px-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:ring" />
            </div>
          )}

          {/* Total + CTA */}
          <div className="border-t border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-4 py-4 shrink-0 space-y-3">

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted font-medium">Total</span>
              <span className="text-2xl font-black tabular-nums text-foreground">{formatXOF(total)}</span>
            </div>

            {quotePending && (
              <div className="text-xs text-center text-muted">Calcul des prix en cours…</div>
            )}

            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {err}
              </div>
            )}

            <button type="button"
              disabled={cart.length === 0 || quotePending}
              onClick={() => setShowPayment(true)}
              className="w-full rounded-xl bg-primary py-4 text-base font-black text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
              Encaisser →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}