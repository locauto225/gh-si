"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api";

type InvoiceStatus = "DRAFT" | "ISSUED" | "SENT" | "ACCEPTED" | "ERROR" | "CANCELLED";
type FneStatus = "PENDING" | "SENT" | "ERROR" | null;

type Client = { id: string; name: string };
type Warehouse = { id: string; code: string; name: string };

type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  total: number;
  clientId?: string | null;
  client?: Client | null;
  warehouseId: string;
  warehouse?: Warehouse | null;
  fneStatus?: FneStatus;
  fneLastError?: string | null;
  fneSentAt?: string | null;
  createdAt: string;
};

type StatusFilter = "all" | InvoiceStatus;
type FneFilter = "all" | "PENDING" | "SENT" | "ERROR";

// ✅ Tables de labels centralisées
const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  SENT: "Transmise",
  ACCEPTED: "Validée",
  ERROR: "Erreur",
  CANCELLED: "Annulée",
};

const FNE_STATUS_LABELS: Record<Exclude<FneStatus, null>, string> = {
  PENDING: "En attente",
  SENT: "Envoyée",
  ERROR: "Erreur",
};

function formatXOF(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "slate";
}) {
  const cls =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
      : tone === "slate"
      ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
      : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function getStatusTone(status: InvoiceStatus): "green" | "amber" | "red" | "slate" | "neutral" {
  if (status === "ACCEPTED" || status === "SENT") return "green";
  if (status === "ISSUED") return "amber";
  if (status === "ERROR") return "red";
  return "slate";
}

function getFneTone(fne: FneStatus): "green" | "amber" | "red" | "slate" {
  if (fne === "SENT") return "green";
  if (fne === "PENDING") return "amber";
  if (fne === "ERROR") return "red";
  return "slate";
}

export default function InvoicesClient() {
  const router = useRouter();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [fne, setFne] = useState<FneFilter>("all");
  const [q, setQ] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (fne !== "all") params.set("fneStatus", fne);
    const qq = q.trim();
    if (qq) params.set("q", qq);
    params.set("limit", "100");
    return params.toString();
  }, [status, fne, q]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ items: Invoice[] }>(`/invoices?${queryString}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Erreur lors du chargement");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const hasActiveFilters = status !== "all" || fne !== "all" || q.trim() !== "";

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Recherche</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° facture, client…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Statut facture</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">Tous</option>
              <option value="DRAFT">Brouillons</option>
              <option value="ISSUED">Émises</option>
              {/* ✅ Plus de "(SI)" dans le label — détail technique inutile */}
              <option value="SENT">Transmises</option>
              <option value="ACCEPTED">Validées</option>
              <option value="ERROR">En erreur</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Statut FNE</label>
            <select
              value={fne}
              onChange={(e) => setFne(e.target.value as FneFilter)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">Tous</option>
              <option value="PENDING">En attente</option>
              <option value="SENT">Envoyées</option>
              <option value="ERROR">Erreur</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end justify-end gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setQ(""); setStatus("all"); setFne("all"); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Réinitialiser
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              Rafraîchir
            </button>
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
          {/* ✅ Titre descriptif + pluriel correct */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Factures</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? "Chargement…" : `${items.length} facture${items.length > 1 ? "s" : ""}`}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {hasActiveFilters ? "Aucune facture ne correspond aux filtres." : "Aucune facture."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Entrepôt</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">FNE</th>
                  <th className="px-4 py-3">Créée</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr
                    key={inv.id}
                    // ✅ Ligne entière cliquable
                    onClick={() => router.push(`/app/invoices/${inv.id}`)}
                    className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {inv.number}
                    </td>
                    <td className="px-4 py-3">
                      {inv.client?.name ?? <span className="text-slate-500 italic">Comptoir</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {inv.warehouse?.name ?? "—"}
                      {inv.warehouse?.code && (
                        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                          ({inv.warehouse.code})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {formatXOF(inv.total ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={getStatusTone(inv.status)}>
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {inv.fneStatus ? (
                          <Badge tone={getFneTone(inv.fneStatus)}>
                            {FNE_STATUS_LABELS[inv.fneStatus]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                        {inv.fneStatus === "ERROR" && inv.fneLastError && (
                          <div className="max-w-[240px] truncate text-xs text-red-600 dark:text-red-300">
                            {inv.fneLastError}
                          </div>
                        )}
                        {inv.fneSentAt && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {fmtDate(inv.fneSentAt)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {fmtDate(inv.createdAt)}
                    </td>
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