"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";

type ReceiptRow = {
  id: string; number: string; issuedAt?: string | null; createdAt: string;
  totalTTC: number; amountPaid: number;
  store?: { id: string; name: string } | null;
  sale?: { id: string; number: string; status: string; client?: { id: string; name: string } | null } | null;
};
type StoreMini = { id: string; code?: string | null; name: string };

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dt)); }
  catch { return String(dt); }
}
function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount ?? 0);
}
function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as any).message);
  return "Erreur";
}

export default function ReceiptsClient({ storeId }: { storeId?: string }) {
  const [items, setItems] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const [stores, setStores] = useState<StoreMini[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(storeId ?? "");

  async function loadStores() {
    setStoresLoading(true);
    try { const res = await apiGet<{ items: StoreMini[] }>("/stores?limit=200"); setStores(res.items ?? []); }
    catch { setStores([]); }
    finally { setStoresLoading(false); }
  }

  async function load() {
    setLoading(true); setErr(null);
    try {
      if (!storeId) { setItems([]); return; }
      const res = await apiGet<{ items: ReceiptRow[] }>(`/pos/receipts?storeId=${encodeURIComponent(storeId)}&limit=100`);
      setItems(res.items ?? []);
    } catch (e: unknown) { setErr(getErrMsg(e)); setItems([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadStores(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { setSelectedStoreId(storeId ?? ""); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [storeId]);

  const selectedStore = useMemo(() => storeId ? stores.find((s) => s.id === storeId) ?? null : null, [storeId, stores]);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Tickets de caisse</h1>
          <div className="text-sm text-muted">
            {selectedStore ? `Magasin : ${selectedStore.name}` : storeId ? `Magasin : ${storeId}` : "Sélectionne un magasin pour afficher les tickets."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/sales"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
            ← Retour ventes
          </Link>
          <button type="button" onClick={load}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Recharger
          </button>
        </div>
      </div>

      {/* Sélecteur de magasin */}
      {!storeId && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          {storesLoading ? (
            <div className="text-sm text-muted">Chargement des magasins…</div>
          ) : stores.length === 0 ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-foreground">Aucun magasin</div>
                <div className="mt-1 text-sm text-muted">Crée un magasin pour utiliser la caisse et générer des tickets.</div>
              </div>
              <Link href="/app/stores"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Créer un magasin
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-foreground">Choisir un magasin</div>
                <div className="mt-1 text-sm text-muted">Sélectionne le magasin à afficher.</div>
              </div>
              <div className="flex w-full max-w-lg items-center gap-2">
                <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring">
                  <option value="" disabled>— Sélectionner —</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" disabled={!selectedStoreId}
                  onClick={() => router.push(`/app/pos/receipts?storeId=${encodeURIComponent(selectedStoreId)}`)}
                  className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  Afficher
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{err}</div>
      )}

      {/* Tableau */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-[color-mix(in_oklab,var(--card),var(--background)_35%)] px-4 py-3 text-sm font-semibold text-foreground rounded-t-xl">
          Derniers tickets
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-muted">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">Aucun ticket.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-[color-mix(in_oklab,var(--card),var(--background)_20%)] text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Vente</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Émis</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Payé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}
                    className="cursor-pointer border-t border-border odd:bg-[color-mix(in_oklab,var(--card),var(--background)_12%)] hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
                    onClick={() => window.location.href = `/app/pos/receipts/${r.id}`}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/app/pos/receipts/${r.id}`} className="hover:underline underline-offset-4" onClick={(e) => e.stopPropagation()}>
                        {r.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.sale?.id
                        ? <Link href={`/app/sales/${r.sale.id}`} className="text-muted hover:text-foreground hover:underline underline-offset-4" onClick={(e) => e.stopPropagation()}>{r.sale.number}</Link>
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{r.sale?.client?.name ?? <span className="text-muted">Comptoir</span>}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{fmt(r.issuedAt ?? r.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatXOF(r.totalTTC ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{formatXOF(r.amountPaid ?? 0)}</td>
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