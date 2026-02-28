"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type PurchaseStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

type PurchaseOrder = {
  id: string;
  number?: string | null;
  status: PurchaseStatus;
  supplierId: string;
  warehouseId: string;
  supplier?: Supplier | null;
  warehouse?: Warehouse | null;
  note?: string | null;
  total?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  receivedAt?: string | null;
};

// ✅ Labels métier pour les statuts
const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Brouillon",
  ORDERED: "Commandé",
  PARTIALLY_RECEIVED: "Partiellement reçu",
  RECEIVED: "Reçu",
  CANCELLED: "Annulé",
};

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function formatXOF(amount?: number | null) {
  const v = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(v);
}

function buildQuery(params: Record<string, string | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

const hasActiveFilters = (from: string, to: string, supplierId: string, warehouseId: string, q: string) =>
  !!(from || to || supplierId || warehouseId || q.trim());

export default function ReceiptsClient() {
  const router = useRouter();

  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Filtres
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");

  const filtersActive = useMemo(
    () => hasActiveFilters(from, to, supplierId, warehouseId, q),
    [from, to, supplierId, warehouseId, q]
  );

  const queryString = useMemo(() => {
    return buildQuery({
      status: "RECEIVED,PARTIALLY_RECEIVED",
      limit: "200",
      from,
      to,
      supplierId,
      warehouseId,
      q,
    });
  }, [from, to, supplierId, warehouseId, q]);

  async function loadSuppliers() {
    try {
      const res = await apiGet<{ items: Supplier[] }>("/suppliers?status=active&limit=200");
      setSuppliers(res.items ?? []);
    } catch {
      setSuppliers([]);
    }
  }

  async function loadWarehouses() {
    try {
      const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active&limit=200");
      setWarehouses(res.items ?? []);
    } catch {
      setWarehouses([]);
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: PurchaseOrder[] }>(`/purchases${queryString}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(errMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function onReset() {
    setFrom("");
    setTo("");
    setSupplierId("");
    setWarehouseId("");
    setQ("");
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Filtres</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              Rafraîchir
            </button>
            {/* ✅ Bouton conditionnel si filtres actifs */}
            {filtersActive && (
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-10">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Du</label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Au</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Fournisseur</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              {/* ✅ "Tous" — plus de tirets doubles */}
              <option value="">Tous les fournisseurs</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Entrepôt</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Tous les entrepôts</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-10">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Recherche</label>
            {/* ✅ Placeholder sans "ID" jargon */}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Numéro de bon de commande, note…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {/* ✅ Note dev supprimée */}
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Réceptions</div>
          {/* ✅ Pluriel correct */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? "Chargement…" : `${items.length} réception${items.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {filtersActive
              ? "Aucune réception ne correspond à ces filtres."
              : "Aucune réception pour l'instant."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date de réception</th>
                  <th className="px-4 py-3">Bon de commande</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Détail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((po) => {
                  const date = po.receivedAt ?? po.updatedAt ?? po.createdAt;
                  const supplierName = po.supplier?.name ?? "—";
                  const whName = po.warehouse?.name ?? "—";
                  const whCode = po.warehouse?.code ?? "";

                  return (
                    <tr
                      key={po.id}
                      // ✅ Ligne entière cliquable — bouton "Ouvrir" retiré
                      onClick={() => router.push(`/app/purchases/${po.id}`)}
                      className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                    >
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {fmtDate(date)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {/* ✅ Fallback numéro sans UUID brut */}
                          {po.number?.trim() ? po.number : `Réception #${po.id.slice(-6)}`}
                        </div>
                        {po.note && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {po.note}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {supplierName}
                      </td>

                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {whName}
                        {whCode && (
                          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                            ({whCode})
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                            po.status === "RECEIVED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                              : po.status === "PARTIALLY_RECEIVED"
                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200"
                              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
                          }`}
                        >
                          {/* ✅ Label métier */}
                          {STATUS_LABELS[po.status] ?? po.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {formatXOF(po.total ?? 0)}
                      </td>

                      <td
                        className="px-4 py-3 text-right"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <Link
                          href={`/app/purchases/${po.id}`}
                          className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                        >
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* ✅ Note dev supprimée */}
          </div>
        )}
      </div>
    </div>
  );
}