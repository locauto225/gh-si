"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { WarehouseScopeSelect, type WarehouseKind } from "@/components/WarehouseScopeSelect";

type InventoryStatus = "DRAFT" | "POSTED" | "CANCELLED";
type InventoryMode = "FULL" | "CATEGORY" | "FREE";

type InventoryRow = {
  id: string;
  number: string;
  status: InventoryStatus;
  mode: InventoryMode;
  note?: string | null;
  createdAt: string;
  postedAt?: string | null;
  warehouse?: { id: string; name: string; code: string; kind: WarehouseKind } | null;
  category?: { id: string; name: string } | null;
  _count?: { lines: number } | null;
};

const STATUS_LABELS: Record<InventoryStatus, string> = {
  DRAFT: "Brouillon",
  POSTED: "Clôturé",
  CANCELLED: "Annulé",
};

const MODE_LABELS: Record<InventoryMode, string> = {
  FULL: "Complet",
  CATEGORY: "Par catégorie",
  FREE: "Libre",
};

function fmtDate(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return String(dt);
  }
}

function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return "Erreur";
}

function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const cls =
    status === "DRAFT"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200"
      : status === "POSTED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200"
      : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function InventoriesListClient() {
  const router = useRouter();

  const [kind, setKind] = useState<WarehouseKind>("DEPOT");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [status, setStatus] = useState<"" | InventoryStatus>("");

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const reqRef = useRef({ id: 0 });

  // ✅ Limite fixée à 100 — pas exposée à l'utilisateur
  const debounced = useDebouncedValue({ warehouseId, status }, 300);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced.warehouseId) params.set("warehouseId", debounced.warehouseId);
    if (debounced.status) params.set("status", debounced.status);
    params.set("limit", "100");
    return params.toString();
  }, [debounced]);

  async function load() {
    const reqId = ++reqRef.current.id;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: InventoryRow[] }>(`/stock/inventories?${queryString}`);
      if (reqId !== reqRef.current.id) return;
      setItems(res.items ?? []);
    } catch (e: unknown) {
      if (reqId !== reqRef.current.id) return;
      setItems([]);
      setErr(getErrMsg(e));
    } finally {
      if (reqId === reqRef.current.id) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const hasFilters = !!warehouseId || !!status;

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-7">
            <WarehouseScopeSelect
              label="Type + lieu"
              kind={kind}
              onKindChange={(k) => {
                setKind(k);
                setWarehouseId("");
              }}
              value={warehouseId}
              onChange={setWarehouseId}
              hint="Choisis d'abord Entrepôt ou Magasin, puis le lieu."
              status="active"
              limit={200}
            />
          </div>

          <div className="md:col-span-5">
            <label className="text-xs text-slate-600 dark:text-slate-300">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | InventoryStatus)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Tous les statuts</option>
              <option value="DRAFT">Brouillon</option>
              <option value="POSTED">Clôturé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => { setWarehouseId(""); setStatus(""); }}
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
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {/* ✅ Pluriel correct */}
            {loading ? "Chargement…" : `${items.length} inventaire${items.length > 1 ? "s" : ""}`}
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {err ? (
          <div className="p-4 text-sm text-red-700 dark:text-red-200">{err}</div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {hasFilters ? "Aucun inventaire pour ces critères." : "Aucun inventaire."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Numéro</th>
                  <th className="px-4 py-3">Lieu</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Lignes</th>
                  <th className="px-4 py-3">Créé</th>
                  <th className="px-4 py-3">Clôturé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => {
                  const wh = inv.warehouse;
                  return (
                    // ✅ Ligne entière cliquable
                    <tr
                      key={inv.id}
                      className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-100 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/40"
                      onClick={() => router.push(`/app/stock/inventories/${inv.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/stock/inventories/${inv.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:underline"
                        >
                          {inv.number}
                        </Link>
                        {inv.note && (
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {inv.note}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{wh?.name ?? "—"}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {wh?.kind === "DEPOT" ? "Entrepôt" : wh?.kind === "STORE" ? "Magasin" : "—"}
                          {wh?.code ? ` · ${wh.code}` : ""}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {MODE_LABELS[inv.mode] ?? inv.mode}
                        {inv.mode === "CATEGORY" && inv.category?.name && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{inv.category.name}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>

                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {inv._count?.lines ?? 0}
                      </td>

                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(inv.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(inv.postedAt ?? null)}
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