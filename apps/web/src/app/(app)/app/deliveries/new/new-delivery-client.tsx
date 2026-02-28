// app/(app)/app/deliveries/new/new-delivery-client.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { ProductPicker, type ProductPickerProduct } from "@/components/ProductPicker";
import { ArrowRight, Search, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "sale" | "order" | "internal";

type Product   = { id: string; sku: string; name: string; unit: string };
type Client    = { id: string; name: string };
type Warehouse = { id: string; code: string; name: string };
type StoreRef  = { id: string; code: string; name: string; warehouseId?: string | null };

type DocLine = {
  id: string; productId: string; qty: number; unitPrice: number;
  qtyDelivered?: number; product: Product;
};
type Doc = {
  id: string; number: string; status: string;
  client: Client | null; warehouse: Warehouse; lines: DocLine[];
};
type DocSearchResult = {
  id: string; number: string; status: string;
  client: Client | null; warehouse: Warehouse;
};
type InternalLine = { productId: string; product: ProductPickerProduct; qty: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errMsg(e: unknown) {
  if (e instanceof ApiError) return `${e.message}${e.code ? ` (${e.code})` : ""}`;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}
function parseQty(raw: string) {
  const n = Number(String(raw).replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? Math.trunc(Math.abs(n)) : 0;
}

// ─── Sélecteur de mode (tabs discrets) ───────────────────────────────────────

const MODES: { key: Mode; label: string }[] = [
  { key: "sale",     label: "Depuis une vente"    },
  { key: "order",    label: "Depuis une commande" },
  { key: "internal", label: "Transfert interne"   },
];

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] p-1">
      {MODES.map((m) => (
        <button key={m.key} type="button" onClick={() => onChange(m.key)}
          className={[
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === m.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          ].join(" ")}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Recherche document ───────────────────────────────────────────────────────

function DocSearch({ mode, onSelect }: { mode: "sale" | "order"; onSelect: (id: string) => void }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<DocSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setError(null); return; }
    setSearching(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "10");

      if (mode === "sale") {
        params.append("status", "POSTED");
      } else {
        // Selon l'API, le multi-status peut être supporté (plusieurs params) ou non.
        params.append("status", "CONFIRMED");
        params.append("status", "PREPARED");
        params.append("status", "SHIPPED");
      }

      const ep = mode === "sale" ? `/sales?${params.toString()}` : `/orders?${params.toString()}`;
      const res = await apiGet<{ items: DocSearchResult[] }>(ep);
      setResults(res.items ?? []);
      return;
    } catch (e) {
      // Fallback : si le filtre status n'est pas supporté côté API, on retente sans status.
      try {
        const params = new URLSearchParams();
        params.set("q", q);
        params.set("limit", "10");
        const ep = mode === "sale" ? `/sales?${params.toString()}` : `/orders?${params.toString()}`;
        const res = await apiGet<{ items: DocSearchResult[] }>(ep);
        setResults(res.items ?? []);
        return;
      } catch (e2) {
        setResults([]);
        setError(errMsg(e2));
      }
    } finally {
      setSearching(false);
    }
  }, [mode]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(query), 280);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "sale" ? "N° vente ou nom du client…" : "N° commande ou nom du client…"}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20" />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setError(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {searching && <div className="px-1 text-xs text-muted">Recherche…</div>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}

      {!searching && !error && query.trim() && results.length === 0 && (
        <div className="px-1 text-xs text-muted">
          Aucun résultat.
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
          {results.map((r) => (
            <button key={r.id} type="button"
              onClick={() => { setResults([]); setQuery(""); onSelect(r.id); }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
              <div>
                <span className="font-medium text-foreground">{r.number}</span>
                <span className="ml-2 text-muted">{r.client?.name ?? "Comptoir"}</span>
              </div>
              <span className="text-xs text-muted">{r.warehouse.name}</span>
            </button>
          ))}
        </div>
      )}

      {!query.trim() && (
        <p className="px-1 text-xs text-muted">
          {mode === "sale"
            ? "Seules les ventes validées peuvent être livrées."
            : "Les commandes confirmées ou préparées peuvent recevoir un BL."}
        </p>
      )}
    </div>
  );
}

// ─── Bannière document sélectionné ───────────────────────────────────────────

function DocBanner({ doc, mode, onClear }: { doc: Doc; mode: "sale" | "order"; onClear: () => void }) {
  const STATUS_LABELS: Record<string, string> = {
    POSTED: "Validée", CONFIRMED: "Confirmée", PREPARED: "Préparée", SHIPPED: "Expédiée",
  };
  const isOk = mode === "sale"
    ? doc.status === "POSTED"
    : ["CONFIRMED", "PREPARED", "SHIPPED"].includes(doc.status);

  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
      isOk
        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
    }`}>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{doc.number}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            isOk
              ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          }`}>
            {STATUS_LABELS[doc.status] ?? doc.status}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {doc.client?.name ?? "Comptoir"} · {doc.warehouse.name}
        </div>
      </div>
      <button type="button" onClick={onClear}
        className="text-xs text-muted underline underline-offset-4 hover:text-foreground">
        Changer
      </button>
    </div>
  );
}

// ─── Tableau lignes ───────────────────────────────────────────────────────────

function LinesTable({ lines, qtyMap, remainingMap, onChange }: {
  lines: DocLine[];
  qtyMap: Record<string, string>;
  remainingMap: Record<string, number>;
  onChange: (id: string, val: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
            <th className="px-4 py-3 text-xs font-medium text-muted">Produit</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted">Commandé</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted">Déjà livré</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted">Restant</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted">Ce bon</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const remaining = remainingMap[l.id] ?? 0;
            const disabled  = remaining <= 0;
            const val       = qtyMap[l.id] ?? "";
            const entered   = parseQty(val);
            const overMax   = entered > 0 && entered > remaining;
            return (
              <tr key={l.id} className={[
                "border-t border-border transition-colors",
                disabled ? "opacity-40" : "hover:bg-[color-mix(in_oklab,var(--card),var(--background)_20%)]",
              ].join(" ")}>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{l.product.name}</div>
                  <div className="text-xs text-muted">{l.product.sku} · {l.product.unit}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{l.qty}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{l.qtyDelivered ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {remaining > 0
                    ? <span className="text-emerald-600 dark:text-emerald-400">{remaining}</span>
                    : <span className="text-muted">0</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    value={val}
                    onChange={(e) => onChange(l.id, e.target.value)}
                    inputMode="numeric"
                    disabled={disabled}
                    placeholder="0"
                    className={[
                      "w-20 rounded-lg border px-2 py-1.5 text-right text-sm text-foreground outline-none focus:ring focus:ring-primary/20 disabled:cursor-not-allowed",
                      overMax
                        ? "border-red-300 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                        : "border-border bg-card",
                    ].join(" ")}
                  />
                  {!disabled && (
                    <div className={`mt-0.5 text-[10px] ${overMax ? "text-red-500" : "text-muted"}`}>
                      {overMax ? `max ${remaining}` : `/ ${remaining}`}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Mode vente / commande (unifié) ──────────────────────────────────────────

function DocumentMode({ mode, initialDocId, onSubmit }: {
  mode: "sale" | "order";
  initialDocId?: string;
  onSubmit: (payload: object) => Promise<void>;
}) {
  const [doc, setDoc]         = useState<Doc | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [note, setNote]       = useState("");
  const [qtyMap, setQtyMap]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);

  async function loadDoc(id: string) {
    setLoading(true); setErr(null); setDoc(null);
    try {
      const res = await apiGet<{ item: Doc }>(mode === "sale" ? `/sales/${id}` : `/orders/${id}`);
      setDoc(res.item);
      const init: Record<string, string> = {};
      for (const l of res.item.lines) {
        const rem = Math.max(0, l.qty - (l.qtyDelivered ?? 0));
        init[l.id] = rem > 0 ? String(rem) : "0";
      }
      setQtyMap(init);
    } catch (e) { setErr(errMsg(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (initialDocId?.trim()) loadDoc(initialDocId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocId]);

  const remainingMap = useMemo(() => {
    const out: Record<string, number> = {};
    if (!doc) return out;
    for (const l of doc.lines) out[l.id] = Math.max(0, l.qty - (l.qtyDelivered ?? 0));
    return out;
  }, [doc]);

  const isReady = mode === "sale"
    ? doc?.status === "POSTED"
    : ["CONFIRMED", "PREPARED", "SHIPPED"].includes(doc?.status ?? "");

  const anyDeliverable = !!doc && doc.lines.some((l) => (remainingMap[l.id] ?? 0) > 0);

  const payloadLines = useMemo(() => {
    if (!doc) return [];
    return doc.lines.map((l) => ({
      [mode === "sale" ? "saleLineId" : "orderLineId"]: l.id,
      qtyDelivered: parseQty(qtyMap[l.id] ?? ""),
    })).filter((x) => x.qtyDelivered > 0);
  }, [doc, qtyMap, mode]);

  const canSubmit = useMemo(() => {
    if (!doc || !isReady || !anyDeliverable || payloadLines.length === 0) return false;
    return payloadLines.every((pl) => {
      const lineId = (mode === "sale" ? pl.saleLineId : pl.orderLineId) as string;
      return pl.qtyDelivered > 0 && pl.qtyDelivered <= (remainingMap[lineId] ?? 0);
    });
  }, [doc, isReady, anyDeliverable, payloadLines, remainingMap, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc || !canSubmit) return;
    setSaving(true); setErr(null);
    try {
      const lines = payloadLines.map((pl) => {
        const lineId = (mode === "sale" ? pl.saleLineId : pl.orderLineId) as string;
        return {
          [mode === "sale" ? "saleLineId" : "orderLineId"]: lineId,
          qtyDelivered: Math.min(pl.qtyDelivered, remainingMap[lineId] ?? 0),
        };
      }).filter((x) => x.qtyDelivered > 0);

      await onSubmit({ [mode === "sale" ? "saleId" : "orderId"]: doc.id, note: note.trim() || null, lines });
    } catch (e) { setErr(errMsg(e)); setSaving(false); }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted">Chargement…</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {doc ? (
        <DocBanner doc={doc} mode={mode}
          onClear={() => { setDoc(null); setQtyMap({}); setErr(null); }} />
      ) : (
        <DocSearch mode={mode} onSelect={loadDoc} />
      )}

      {doc && !isReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {mode === "sale"
            ? "Cette vente doit être validée avant de créer un bon de livraison."
            : "Cette commande doit être au moins confirmée avant de créer un bon de livraison."}
        </div>
      )}

      {doc && isReady && !anyDeliverable && (
        <div className="rounded-lg border border-border px-4 py-3 text-sm text-muted">
          Toutes les lignes ont déjà été livrées. Rien à livrer sur ce document.
        </div>
      )}

      {doc && isReady && anyDeliverable && (
        <>
          <LinesTable lines={doc.lines} qtyMap={qtyMap} remainingMap={remainingMap}
            onChange={(id, val) => setQtyMap((m) => ({ ...m, [id]: val }))} />

          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optionnel) — ex : livraison partielle, reliquat à suivre…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20" />

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">{err}</div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setDoc(null); setQtyMap({}); setErr(null); }}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground">
              Annuler
            </button>
            <button type="submit" disabled={saving || !canSubmit}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Création…" : "Créer le bon de livraison →"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

// ─── Mode transfert interne ───────────────────────────────────────────────────

function InternalMode({ onSubmit }: { onSubmit: (payload: object) => Promise<void> }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stores, setStores]         = useState<StoreRef[]>([]);
  const [fromId, setFromId]         = useState("");
  const [destType, setDestType]     = useState<"store" | "warehouse">("store");
  const [toStoreId, setToStoreId]   = useState("");
  const [toWhId, setToWhId]         = useState("");
  const [lines, setLines]           = useState<InternalLine[]>([]);
  const [product, setProduct]       = useState<ProductPickerProduct | null>(null);
  const [qty, setQty]               = useState("1");
  const [note, setNote]             = useState("");
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [wRes, sRes] = await Promise.all([
          apiGet<{ items: Warehouse[] }>("/warehouses?status=active"),
          apiGet<{ items: StoreRef[] }>("/stores?status=active"),
        ]);
        setWarehouses(wRes.items ?? []);
        setStores(sRes.items ?? []);
      } catch { /* silencieux */ }
    })();
  }, []);

  function addLine() {
    const q = parseQty(qty);
    if (!product) { setErr("Choisis un produit."); return; }
    if (!q)       { setErr("Quantité invalide."); return; }
    setErr(null);
    setLines((prev) => {
      const idx = prev.findIndex((x) => x.productId === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + q };
        return copy;
      }
      return [...prev, { productId: product.id, product, qty: q }];
    });
    setProduct(null);
    setQty("1");
  }

  const canSubmit = useMemo(() => {
    if (!fromId) return false;
    if (destType === "store" && !toStoreId) return false;
    if (destType === "warehouse" && !toWhId) return false;
    return lines.length > 0 && lines.every((l) => l.qty > 0);
  }, [fromId, destType, toStoreId, toWhId, lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true); setErr(null);
    try {
      const payload: Record<string, unknown> = {
        fromWarehouseId: fromId,
        note: note.trim() || null,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      };
      if (destType === "store") payload.toStoreId = toStoreId;
      else payload.toWarehouseId = toWhId;
      await onSubmit(payload);
    } catch (e) { setErr(errMsg(e)); setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Trajet */}
      <div className="grid gap-3 sm:grid-cols-[1fr_24px_1fr]">
        <div>
          <label className="mb-1 block text-xs text-muted">Entrepôt source *</label>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/20">
            <option value="">— Choisir</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </div>
        <div className="flex items-end justify-center pb-3">
          <ArrowRight className="h-4 w-4 text-muted" />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-muted">Destination *</label>
            <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
              {(["store", "warehouse"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setDestType(t)}
                  className={`px-2.5 py-1 font-medium ${destType === t ? "bg-primary text-primary-foreground" : "bg-card text-muted hover:text-foreground"}`}>
                  {t === "store" ? "Magasin" : "Entrepôt"}
                </button>
              ))}
            </div>
          </div>
          {destType === "store" ? (
            <select value={toStoreId} onChange={(e) => setToStoreId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/20">
              <option value="">— Choisir un magasin</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          ) : (
            <select value={toWhId} onChange={(e) => setToWhId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring focus:ring-primary/20">
              <option value="">— Choisir un entrepôt</option>
              {warehouses.filter((w) => w.id !== fromId).map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Produits */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-medium text-foreground">Produits à expédier</div>
        <div className="flex gap-2">
          <div className="flex-1">
            <ProductPicker variant="compact" value={product}
              onChange={(p) => { setProduct(p); setErr(null); }}
              placeholder="Saisir un nom, une référence…" />
          </div>
          <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)}
            placeholder="Qté"
            className="w-20 rounded-lg border border-border bg-card px-3 py-2 text-right text-sm text-foreground outline-none focus:ring focus:ring-primary/20" />
          <button type="button" onClick={addLine}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Ajouter
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted">
            Aucun produit ajouté.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_30%)]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted">Produit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted">Quantité</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{l.product.name}</div>
                      <div className="text-xs text-muted">{l.product.sku}{l.product.unit ? ` · ${l.product.unit}` : ""}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input inputMode="numeric" value={String(l.qty)}
                        onChange={(e) => {
                          const q = parseQty(e.target.value);
                          setLines((prev) => prev.map((x) => x.productId === l.productId ? { ...x, qty: q } : x));
                        }}
                        className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-right text-sm outline-none focus:ring focus:ring-primary/20" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button"
                        onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/20">
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel) — ex : réassort semaine 12, urgence…"
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring focus:ring-primary/20" />

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">{err}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setLines([])}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted hover:text-foreground">
          Réinitialiser
        </button>
        <button type="submit" disabled={saving || !canSubmit}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Création…" : "Créer le bon de livraison →"}
        </button>
      </div>
    </form>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function NewDeliveryClient({
  mode: initialMode = "sale",
  saleId,
  orderId,
}: {
  mode?: Mode;
  saleId?: string;
  orderId?: string;
}) {
  const router = useRouter();
  const hasContext = !!(saleId || orderId);
  const [mode, setMode] = useState<Mode>(initialMode);

  async function handleSubmit(payload: object) {
    const res = await apiPost<{ item: { id: string } }>("/deliveries", payload);
    router.push(`/app/deliveries/${res.item.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">

      <div>
        <h1 className="text-lg font-semibold text-foreground">Nouveau bon de livraison</h1>
        <p className="mt-0.5 text-sm text-muted">
          {mode === "sale"     && "Depuis une vente validée — le partiel est possible."}
          {mode === "order"    && "Depuis une commande B2B confirmée — le partiel est possible."}
          {mode === "internal" && "Transfert de stock depuis un entrepôt."}
        </p>
      </div>

      {/* Tabs de mode — cachés si contexte pré-rempli depuis une fiche */}
      {!hasContext && <ModeTabs mode={mode} onChange={setMode} />}

      {mode === "sale" && (
        <DocumentMode key="sale" mode="sale" initialDocId={saleId} onSubmit={handleSubmit} />
      )}
      {mode === "order" && (
        <DocumentMode key="order" mode="order" initialDocId={orderId} onSubmit={handleSubmit} />
      )}
      {mode === "internal" && (
        <InternalMode onSubmit={handleSubmit} />
      )}

    </div>
  );
}