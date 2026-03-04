"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import {
  ChevronRight,
  Info,
  Trash2,
  Search,
  Building2,
  User,
  Phone,
  Calendar,
  CalendarCheck,
  FileText,
  Hash,
  Pencil,
  Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Warehouse = {
  id: string; name: string; code?: string | null;
  priceListId?: string | null; priceList?: { name: string } | null;
};
type Client = {
  id: string; name: string;
  phone?: string | null;
  address?: string | null;
  paymentTermsDays?: number | null;
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
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function generateBCRef() {
  const y = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `BC-${y}-${n}`;
}

const INPUT =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20";
const LABEL = "block text-xs font-medium text-muted mb-1";

// ─── Autocomplete générique ───────────────────────────────────────────────────

function Autocomplete<T extends { id: string; name: string }>({
  items,
  value,
  placeholder,
  onSelect,
  onClear,
  renderItem,
  renderSelected,
}: {
  items: T[];
  value: T | null;
  placeholder: string;
  onSelect: (item: T) => void;
  onClear: () => void;
  renderItem: (item: T) => React.ReactNode;
  renderSelected?: (item: T) => React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items.filter((i) => i.name.toLowerCase().includes(s)).slice(0, 8);
  }, [items, q]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <div className="min-w-0 flex-1 text-sm">
          {renderSelected ? renderSelected(value) : (
            <span className="font-medium text-foreground">{value.name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onClear(); setQ(""); }}
          className="ml-2 shrink-0 rounded p-0.5 text-muted hover:text-foreground transition-colors"
          aria-label="Changer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 focus-within:ring focus-within:ring-primary/20">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg divide-y divide-border">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]"
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-border bg-card px-4 py-3 shadow-lg text-sm text-muted">
          Aucun résultat.
        </div>
      )}
    </div>
  );
}

// ─── Recherche produit (ajout à la liste) ─────────────────────────────────────

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
    return products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(s)).slice(0, 8);
  }, [products, q]);

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
          placeholder="Rechercher par nom ou SKU…"
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [clients, setClients]       = useState<Client[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  // En-tête bon de commande
  const [bcRef, setBcRef]             = useState(() => generateBCRef());
  const [editingRef, setEditingRef]   = useState(false);
  const [orderDate, setOrderDate]     = useState(todayISO());
  const [deliveryDate, setDeliveryDate] = useState("");

  // Contexte commande
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedClient, setSelectedClient]       = useState<Client | null>(null);
  const [note, setNote]                           = useState("");
  const [fulfillment, setFulfillment]             = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [shippingFee, setShippingFee]             = useState(0);

  // Lignes
  const [lines, setLines] = useState<LineItem[]>([]);

  // Quote
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteSeq = useRef(0);

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  // ── Dérivés ──────────────────────────────────────────────────────────────────

  const productMap  = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const noPriceList = !!selectedWarehouse && !selectedWarehouse.priceListId;

  const subtotal  = useMemo(
    () => lines.reduce((s, l) => s + l.qty * (l.unitPrice ?? 0), 0),
    [lines]
  );
  const grandTotal = subtotal + (fulfillment === "DELIVERY" ? shippingFee : 0);
  const canSave    = !refLoading && !saving && !quoteLoading && lines.length > 0 && !!selectedWarehouse;

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
        if (whs[0]) setSelectedWarehouse(whs[0]);
      } catch (e) {
        setErr(getErr(e));
      } finally {
        setRefLoading(false);
      }
    })();
  }, []);

  // ── Quote ─────────────────────────────────────────────────────────────────────

  async function runQuote(nextLines?: LineItem[]) {
    const cls = nextLines ?? lines;
    if (!cls.length || !selectedWarehouse) return;
    const id = ++quoteSeq.current;
    setQuoteLoading(true);
    try {
      const res = await apiPost<QuoteResult>("/orders/quote", {
        warehouseId: selectedWarehouse.id,
        clientId: selectedClient?.id ?? null,
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
      // silencieux
    } finally {
      if (id === quoteSeq.current) setQuoteLoading(false);
    }
  }

  useEffect(() => {
    if (lines.length) runQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouse?.id, selectedClient?.id]);

  // ── Lignes ───────────────────────────────────────────────────────────────────

  function addProduct(p: Product) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      let next: LineItem[];
      if (idx >= 0) {
        next = prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l);
      } else {
        next = [...prev, { key: `${p.id}-${Date.now()}`, productId: p.id, qty: 1, unitPrice: p.price ?? null }];
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
      prev.map((l) => l.key === key ? { ...l, unitPrice: val === "" ? null : toInt(val, 0) } : l)
    );
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  async function saveOrder() {
    if (!selectedWarehouse) { setErr("Sélectionne un entrepôt."); return; }
    if (!lines.length) { setErr("Ajoute au moins un produit."); return; }
    setSaving(true); setErr(null);
    try {
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
        reference: bcRef,
        orderDate,
        deliveryDate: deliveryDate || null,
        warehouseId: selectedWarehouse.id,
        clientId: selectedClient?.id ?? null,
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
    <div className="space-y-5 pb-10">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/app/orders" className="hover:text-foreground hover:underline underline-offset-4">
          Commandes
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Nouveau bon de commande</span>
      </div>

      {refLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          Chargement…
        </div>
      ) : (
        <div className="space-y-4">

          {/* ══════════════════════════════════════════════════════════════════
              DOCUMENT HEADER — identité du bon de commande
          ══════════════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

            {/* Bandeau titre */}
            <div className="flex items-center justify-between border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Bon de commande</span>
              </div>

              {/* Numéro de BC éditable */}
              <div className="flex items-center gap-2">
                {editingRef ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={bcRef}
                      onChange={(e) => setBcRef(e.target.value)}
                      onBlur={() => setEditingRef(false)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingRef(false)}
                      className="w-40 rounded-md border border-primary bg-card px-2 py-1 text-xs font-mono font-semibold text-foreground outline-none focus:ring focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingRef(false)}
                      className="rounded p-1 text-primary hover:bg-primary/10"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingRef(true)}
                    className="group flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-mono font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <Hash className="h-3 w-3 text-muted group-hover:text-primary" />
                    {bcRef}
                    <Pencil className="h-3 w-3 text-muted group-hover:text-primary" />
                  </button>
                )}
              </div>
            </div>

            {/* Corps — 2 colonnes : émetteur/destinataire + dates */}
            <div className="grid gap-0 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">

              {/* Colonne gauche : entrepôt + client */}
              <div className="p-5 space-y-5">

                {/* Entrepôt expéditeur */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                    <Building2 className="h-3.5 w-3.5" />
                    Entrepôt expéditeur <span className="text-red-500">*</span>
                  </label>
                  <Autocomplete
                    items={warehouses}
                    value={selectedWarehouse}
                    placeholder="Rechercher un entrepôt…"
                    onSelect={setSelectedWarehouse}
                    onClear={() => setSelectedWarehouse(null)}
                    renderItem={(w) => (
                      <div className="flex-1">
                        <span className="font-medium text-foreground">{w.name}</span>
                        {w.code && <span className="ml-2 text-xs text-muted">{w.code}</span>}
                      </div>
                    )}
                    renderSelected={(w) => (
                      <div>
                        <div className="font-semibold text-foreground">{w.name}</div>
                        {w.code && <div className="text-xs text-muted">{w.code}</div>}
                      </div>
                    )}
                  />
                  {noPriceList && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Aucune grille tarifaire — les prix ne seront pas calculés automatiquement.
                    </div>
                  )}
                  {selectedWarehouse?.priceList && (
                    <div className="mt-1.5 text-xs text-muted">
                      Tarif appliqué : <span className="font-medium text-foreground">{selectedWarehouse.priceList.name}</span>
                    </div>
                  )}
                </div>

                {/* Client destinataire */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                    <User className="h-3.5 w-3.5" />
                    Client destinataire
                  </label>
                  <Autocomplete
                    items={clients}
                    value={selectedClient}
                    placeholder="Rechercher un client…"
                    onSelect={setSelectedClient}
                    onClear={() => setSelectedClient(null)}
                    renderItem={(c) => (
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{c.name}</div>
                        {c.phone && <div className="text-xs text-muted">{c.phone}</div>}
                      </div>
                    )}
                    renderSelected={(c) => (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground">{c.name}</div>
                        {c.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted">
                            <Phone className="h-3 w-3" />{c.phone}
                          </div>
                        )}
                        {c.address && <div className="text-xs text-muted">{c.address}</div>}
                        {c.paymentTermsDays && (
                          <div className="text-xs text-muted">
                            Délai paiement : <span className="font-medium text-foreground">{c.paymentTermsDays} j</span>
                          </div>
                        )}
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Colonne droite : dates + mode + note */}
              <div className="p-5 space-y-4">

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Date de commande
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Livraison souhaitée
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      min={orderDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className={INPUT}
                    />
                  </div>
                </div>

                {/* Mode de retrait */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                    Mode de retrait
                  </label>
                  <div className="flex gap-2">
                    {(["PICKUP", "DELIVERY"] as const).map((m) => (
                      <button
                        key={m} type="button"
                        onClick={() => setFulfillment(m)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          fulfillment === m
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted hover:text-foreground"
                        }`}
                      >
                        {m === "PICKUP" ? "Enlèvement" : "Livraison"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frais livraison */}
                {fulfillment === "DELIVERY" && (
                  <div>
                    <label className={LABEL}>Frais de livraison (XOF)</label>
                    <input
                      type="number" min={0} value={shippingFee}
                      onChange={(e) => setShippingFee(toInt(e.target.value, 0))}
                      className={INPUT}
                    />
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className={LABEL}>Note interne (optionnel)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={fulfillment === "DELIVERY" ? 2 : 3}
                    placeholder="Instructions de préparation, livraison…"
                    className={`${INPUT} resize-none`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              LIGNES DE COMMANDE
          ══════════════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold text-foreground">
                Lignes de commande
                {lines.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    {lines.length} article{lines.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Barre de recherche produit */}
            <div className="border-b border-border px-5 py-3">
              <ProductSearch products={products} onSelect={addProduct} />
            </div>

            {/* Tableau */}
            {lines.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                  <FileText className="h-5 w-5 text-muted" />
                </div>
                <div className="text-sm font-medium text-foreground">Aucun article</div>
                <div className="mt-1 text-xs text-muted">Recherchez un produit ci-dessus pour commencer à saisir le bon de commande.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]">
                    <tr>
                      <th className="px-5 py-3 w-8 text-center">#</th>
                      <th className="px-4 py-3">Désignation</th>
                      <th className="px-4 py-3 text-right w-28">Quantité</th>
                      <th className="px-4 py-3 text-center w-16">Unité</th>
                      <th className="px-4 py-3 text-right w-36">Prix unit. (XOF)</th>
                      <th className="px-4 py-3 text-right w-36">Montant (XOF)</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => {
                      const p  = productMap.get(l.productId);
                      const pu = l.unitPrice ?? 0;
                      return (
                        <tr
                          key={l.key}
                          className="border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_8%)]"
                        >
                          {/* N° ligne */}
                          <td className="px-5 py-3 text-center text-xs text-muted tabular-nums">
                            {idx + 1}
                          </td>
                          {/* Désignation */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{p?.name ?? "—"}</div>
                            <div className="text-xs text-muted">{p?.sku}</div>
                          </td>
                          {/* Quantité */}
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min={1} value={l.qty}
                              onChange={(e) => updateLineQty(l.key, toInt(e.target.value, 1))}
                              className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-right text-sm text-foreground outline-none focus:ring focus:ring-primary/20"
                            />
                          </td>
                          {/* Unité */}
                          <td className="px-4 py-3 text-center text-xs text-muted">{p?.unit}</td>
                          {/* Prix unitaire */}
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min={0}
                              value={l.unitPrice ?? ""}
                              onChange={(e) => updateLinePrice(l.key, e.target.value)}
                              placeholder={quoteLoading ? "Calcul…" : "Auto"}
                              className="w-28 rounded-lg border border-border bg-card px-2 py-1.5 text-right text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20"
                            />
                          </td>
                          {/* Montant */}
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                            {formatXOF(l.qty * pu)}
                          </td>
                          {/* Supprimer */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(l.key)}
                              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            >
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

            {/* Pied de tableau — totaux + CTA */}
            {lines.length > 0 && (
              <div className="border-t border-border bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] px-5 py-4 rounded-b-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                  {/* Totaux */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-4">
                      <span className="w-40 text-muted">Sous-total HT</span>
                      <span className="font-medium tabular-nums text-foreground">{formatXOF(subtotal)}</span>
                    </div>
                    {fulfillment === "DELIVERY" && shippingFee > 0 && (
                      <div className="flex items-center gap-4">
                        <span className="w-40 text-muted">Frais de livraison</span>
                        <span className="font-medium tabular-nums text-foreground">{formatXOF(shippingFee)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 border-t border-border pt-2 mt-2">
                      <span className="w-40 text-base font-bold text-foreground">Total TTC</span>
                      <span className="text-xl font-bold text-foreground tabular-nums">
                        {formatXOF(grandTotal)}
                        {quoteLoading && (
                          <span className="ml-2 text-xs font-normal text-muted">calcul en cours…</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={saveOrder}
                      className="rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
                    >
                      {saving ? "Enregistrement…" : "Enregistrer le bon de commande →"}
                    </button>
                    <p className="text-xs text-muted">
                      Le bon sera enregistré en brouillon — vous pourrez le confirmer depuis la fiche.
                    </p>
                  </div>
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