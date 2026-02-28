// apps/web/src/app/(app)/app/fiscal/fiscal-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiGet } from "@/lib/api";

type FneStatus = "PENDING" | "SENT" | "ACCEPTED" | "ERROR";

type FneSummary = {
  total: number;
  toProcess: number;
  byFneStatus: {
    none: number;
    pending: number;
    sent: number;
    accepted: number;
    error: number;
  };
};

type FneLinkedInvoice = {
  id: string;
  number: string;
  status: string;
  fneStatus: FneStatus | null;
  fneRef: string | null;
};

type FneLinkedSale = {
  id: string;
  number: string;
  status: string;
  fneStatus: FneStatus | null;
  fneRef: string | null;
};

type FneEventRow = {
  id: string;
  createdAt: string;
  status: FneStatus;
  payloadHash?: string | null;
  request?: string | null;
  response?: string | null;
  error?: string | null;
  fneRef?: string | null;
  invoice?: FneLinkedInvoice | null;
  sale?: FneLinkedSale | null;
};

// ✅ Labels métier pour les statuts FNE
const FNE_STATUS_LABELS: Record<FneStatus, string> = {
  PENDING: "En attente",
  SENT: "Envoyée",
  ACCEPTED: "Acceptée",
  ERROR: "Erreur",
};

// ✅ Labels répartition summary — cohérents en français
const FNE_SUMMARY_LABELS: Record<string, string> = {
  none: "Sans statut",
  pending: "En attente",
  sent: "Envoyées",
  accepted: "Acceptées",
  error: "En erreur",
};

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

function statusBadgeCls(status: FneStatus | string) {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "SENT":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200";
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200";
    case "ERROR":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300";
  }
}

export default function FiscalClient() {
  const [summary, setSummary] = useState<FneSummary | null>(null);
  const [events, setEvents] = useState<FneEventRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  // ✅ Erreurs séparées — une erreur events n'efface pas l'erreur summary
  const [errSummary, setErrSummary] = useState<string | null>(null);
  const [errEvents, setErrEvents] = useState<string | null>(null);

  const [entity, setEntity] = useState<"all" | "invoice" | "sale">("invoice");
  const [status, setStatus] = useState<"all" | FneStatus>("all");
  const [limit, setLimit] = useState<number>(100);

  const eventsQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (entity !== "all") qs.set("entity", entity);
    if (status !== "all") qs.set("status", status);
    qs.set("limit", String(limit));
    return `/fne/events?${qs.toString()}`;
  }, [entity, status, limit]);

  async function loadSummary() {
    setLoadingSummary(true);
    setErrSummary(null);
    try {
      const res = await apiGet<FneSummary>("/fne/summary");
      setSummary(res);
    } catch (e: unknown) {
      setErrSummary(getErrMsg(e, "Erreur lors du chargement du résumé FNE"));
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadEvents() {
    setLoadingEvents(true);
    setErrEvents(null);
    try {
      const res = await apiGet<{ items: FneEventRow[] }>(eventsQuery);
      setEvents(res.items ?? []);
    } catch (e: unknown) {
      setErrEvents(getErrMsg(e, "Erreur lors du chargement des événements FNE"));
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsQuery]);

  // ✅ Répartition sous forme de tableau pour éviter la répétition JSX
  const summaryRows = useMemo(() => {
    if (!summary) return [];
    return (Object.entries(summary.byFneStatus) as [keyof FneSummary["byFneStatus"], number][]).map(
      ([key, count]) => ({
        key,
        label: FNE_SUMMARY_LABELS[key] ?? key,
        count,
        badgeCls:
          key === "accepted"
            ? statusBadgeCls("ACCEPTED")
            : key === "sent"
            ? statusBadgeCls("SENT")
            : key === "pending"
            ? statusBadgeCls("PENDING")
            : key === "error"
            ? statusBadgeCls("ERROR")
            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
      })
    );
  }, [summary]);

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="grid gap-3 md:grid-cols-6">
        {/* Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800 md:col-span-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total factures FNE</div>
          <div className="mt-1 tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {loadingSummary ? "…" : (summary?.total ?? 0)}
          </div>
          {errSummary && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">{errSummary}</div>
          )}
        </div>

        {/* À traiter */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800 md:col-span-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            À transmettre à la FNE
          </div>
          <div className="mt-1 tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {loadingSummary ? "…" : (summary?.toProcess ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Émises, non encore acceptées
          </div>
        </div>

        {/* Répartition */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800 md:col-span-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">Répartition par statut FNE</div>
          {loadingSummary ? (
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
              {/* ✅ Labels français cohérents */}
              {summaryRows.map(({ key, label, count, badgeCls }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${
                    key === "error" ? "col-span-2" : ""
                  } ${badgeCls}`}
                >
                  <span>{label}</span>
                  <span className="tabular-nums font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Événements */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Historique des transmissions FNE
            </div>
            {/* ✅ Description métier — plus de tutoiement dev ni de "simulateur / audit" */}
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Toutes les transmissions envoyées ou en attente vers la DGI.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre entité */}
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value as "all" | "invoice" | "sale")}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              <option value="invoice">Factures</option>
              <option value="sale">Ventes</option>
              <option value="all">Toutes</option>
            </select>

            {/* Filtre statut — ✅ labels traduits */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | FneStatus)}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              <option value="all">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="SENT">Envoyées</option>
              <option value="ACCEPTED">Acceptées</option>
              <option value="ERROR">En erreur</option>
            </select>

            {/* Filtre limite — conservé dans ce contexte d'audit, avec label */}
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              title="Nombre de lignes"
            >
              <option value="50">50 lignes</option>
              <option value="100">100 lignes</option>
              <option value="200">200 lignes</option>
              <option value="500">500 lignes</option>
            </select>

            <button
              type="button"
              onClick={() => { loadSummary(); loadEvents(); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              Rafraîchir
            </button>
          </div>
        </div>

        {errEvents && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {errEvents}
          </div>
        )}

        {loadingEvents ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Chargement…
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucune transmission{entity !== "all" ? ` (${entity === "invoice" ? "factures" : "ventes"})` : ""} pour ce filtre.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Numéro</th>
                  {/* ✅ "Statut FNE" — clair dans ce contexte */}
                  <th className="px-4 py-3">Statut FNE</th>
                  <th className="px-4 py-3">Référence FNE</th>
                  <th className="px-4 py-3">Erreur</th>
                  <th className="px-4 py-3 text-right">Détail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const isInvoice = !!ev.invoice?.id;
                  const targetId = ev.invoice?.id ?? ev.sale?.id ?? "";
                  const number = ev.invoice?.number ?? ev.sale?.number ?? "—";
                  const entityLabel = isInvoice ? "Facture" : ev.sale?.id ? "Vente" : "—";
                  const openHref = isInvoice
                    ? `/app/invoices/${targetId}`
                    : ev.sale?.id
                    ? `/app/orders/${targetId}`
                    : "#";
                  const fneRef = ev.invoice?.fneRef ?? ev.sale?.fneRef ?? ev.fneRef ?? null;

                  return (
                    <tr
                      key={ev.id}
                      className="border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                    >
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {fmtDate(ev.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {entityLabel}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {number}
                      </td>
                      <td className="px-4 py-3">
                        {/* ✅ Label traduit — plus de "PENDING" / "ERROR" brut */}
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeCls(ev.status)}`}>
                          {FNE_STATUS_LABELS[ev.status] ?? ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {fneRef ? (
                          <span className="font-mono text-xs">{fneRef}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        {ev.error ? (
                          <span className="line-clamp-2 text-xs text-red-600 dark:text-red-400">
                            {ev.error}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {targetId ? (
                          <Link
                            href={openHref}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                          >
                            Ouvrir
                          </Link>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
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