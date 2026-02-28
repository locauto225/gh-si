"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

type Warehouse = { id: string; code: string; name: string; kind: "DEPOT" | "STORE" };
type Category = { id: string; name: string; slug?: string | null };
type Product = { id: string; sku: string; name: string; unit?: string | null; category?: Category | null };

type InventoryLineStatus = "PENDING" | "COUNTED" | "SKIPPED";
type InventoryStatus = "DRAFT" | "POSTED" | "CANCELLED";
type InventoryMode = "FULL" | "CATEGORY" | "FREE";

type InventoryLine = {
  id: string;
  productId: string;
  expectedQty: number;
  countedQty: number | null;
  delta: number;
  status: InventoryLineStatus;
  note?: string | null;
  product?: Product | null;
};

type StockInventory = {
  id: string;
  number: string;
  status: InventoryStatus;
  mode: InventoryMode;
  note?: string | null;
  postedAt?: string | null;
  postedBy?: string | null;
  warehouseId: string;
  warehouse?: Warehouse | null;
  categoryId?: string | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
  lines?: InventoryLine[];
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

const LINE_STATUS_LABELS: Record<InventoryLineStatus, string> = {
  PENDING: "En attente",
  COUNTED: "Compté",
  SKIPPED: "Ignoré",
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

function StatusBadge({ status }: { status: InventoryStatus }) {
  const cls =
    status === "POSTED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-200"
      : status === "CANCELLED"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// Barre de progression compacte
function ProgressBar({ counted, total }: { counted: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((counted / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-2 rounded-full transition-all ${
            pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-400" : "bg-slate-200 dark:bg-slate-700"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {counted}/{total}
      </span>
    </div>
  );
}

export default function InventoryDetailsClient({ id }: { id: string }) {
  const [inv, setInv] = useState<StockInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [postNote, setPostNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [lineFilter, setLineFilter] = useState<"ALL" | "PENDING" | "COUNTED" | "SKIPPED">("ALL");

  const reqRef = useRef({ id: 0 });

  const isDraft = inv?.status === "DRAFT";

  async function load() {
    const reqId = ++reqRef.current.id;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: StockInventory }>(`/stock/inventories/${id}`);
      if (reqId !== reqRef.current.id) return;
      setInv(res.item ?? null);
    } catch (e: unknown) {
      if (reqId !== reqRef.current.id) return;
      setInv(null);
      setErr(getErrMsg(e));
    } finally {
      if (reqId === reqRef.current.id) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const lines = inv?.lines ?? [];

  const stats = useMemo(() => {
    const total = lines.length;
    const pending = lines.filter((l) => l.status === "PENDING").length;
    const counted = lines.filter((l) => l.status === "COUNTED").length;
    const skipped = lines.filter((l) => l.status === "SKIPPED").length;
    const adjustments = lines.filter(
      (l) => l.countedQty !== null && l.status !== "SKIPPED" && (l.delta ?? 0) !== 0
    ).length;
    const countedOrSkipped = counted + skipped;
    return { total, pending, counted, skipped, adjustments, countedOrSkipped };
  }, [lines]);

  const filteredLines = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return lines.filter((l) => {
      if (lineFilter !== "ALL" && l.status !== lineFilter) return false;
      if (!qq) return true;
      const p = l.product;
      return `${p?.name ?? ""} ${p?.sku ?? ""} ${p?.unit ?? ""}`.toLowerCase().includes(qq);
    });
  }, [lines, q, lineFilter]);

  const canGenerate = !!inv && inv.status === "DRAFT" && (inv.lines?.length ?? 0) === 0;

  // ✅ Condition post explicite — on vérifie aussi si la note est assez longue
  const postNoteOk = postNote.trim().length >= 3;
  const hasCountedLine = lines.some((l) => l.countedQty !== null && l.status !== "SKIPPED");
  const canPost = !!inv && inv.status === "DRAFT" && !!lines.length && postNoteOk && hasCountedLine;

  async function onGenerate() {
    if (!inv) return;
    setErr(null);
    setGenerating(true);
    try {
      await apiPost(`/stock/inventories/${inv.id}/generate`, {
        mode: inv.mode,
        categoryId: inv.mode === "CATEGORY" ? inv.categoryId ?? null : null,
      });
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setGenerating(false);
    }
  }

  async function updateLine(
    lineId: string,
    patch: { countedQty?: number | null; status?: InventoryLineStatus; note?: string | null }
  ) {
    if (!inv) return;
    setErr(null);
    setSavingLineId(lineId);
    try {
      await apiPatch(`/stock/inventories/${inv.id}/lines/${lineId}`, patch);
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setSavingLineId(null);
    }
  }

  async function onPost() {
    if (!inv) return;
    setErr(null);
    setPosting(true);
    try {
      await apiPost(`/stock/inventories/${inv.id}/post`, {
        note: postNote.trim(),
        postedBy: null,
      });
      // ✅ Message de succès après clôture
      setSuccess("Inventaire clôturé — les ajustements de stock ont été appliqués.");
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e));
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
    );
  }

  if (!inv) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        {err ?? "Inventaire introuvable."}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ============================================================
          Header
      ============================================================ */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{inv.number}</span>
            <StatusBadge status={inv.status} />
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200">
              {inv.warehouse?.kind === "STORE" ? "Magasin" : "Entrepôt"} · {inv.warehouse?.name ?? "—"}
              <span className="ml-1 text-slate-400">({inv.warehouse?.code ?? "—"})</span>
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {MODE_LABELS[inv.mode]}
              {inv.mode === "CATEGORY" && inv.category?.name ? ` · ${inv.category.name}` : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div><span className="text-slate-400">Créé :</span> {fmtDate(inv.createdAt)}</div>
          {inv.postedAt && <div><span className="text-slate-400">Clôturé :</span> {fmtDate(inv.postedAt)}</div>}
          {inv.note && <div><span className="text-slate-400">Note :</span> {inv.note}</div>}
        </div>

        {/* ✅ Stats + barre de progression */}
        {lines.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Avancement du comptage</span>
              <span className="tabular-nums">{stats.counted + stats.skipped} / {stats.total} traités</span>
            </div>
            <ProgressBar counted={stats.counted + stats.skipped} total={stats.total} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 mt-2">
              {[
                { label: "Total", value: stats.total, accent: "" },
                { label: "En attente", value: stats.pending, accent: stats.pending > 0 ? "text-amber-600 dark:text-amber-400" : "" },
                { label: "Comptées", value: stats.counted, accent: stats.counted > 0 ? "text-emerald-600 dark:text-emerald-400" : "" },
                { label: "Ignorées", value: stats.skipped, accent: "" },
                { label: "Écarts", value: stats.adjustments, accent: stats.adjustments > 0 ? "text-red-600 dark:text-red-400" : "" },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
                  <div className={`text-sm font-semibold ${accent || "text-slate-900 dark:text-slate-100"}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Générer les lignes */}
        {canGenerate && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/20">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Aucune ligne. Génère la liste des produits avant de commencer le comptage.
            </div>
            <button
              type="button"
              disabled={!canGenerate || generating}
              onClick={onGenerate}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {generating ? "Génération…" : "Générer les lignes"}
            </button>
          </div>
        )}
      </div>

      {/* Feedback global */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}
      {err && !posting && !generating && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* ============================================================
          Filtres + tableau des lignes
      ============================================================ */}
      {lines.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">

          {/* Filtres dans une section dédiée */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
              Lignes
              <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                {filteredLines.length !== lines.length ? `${filteredLines.length} / ${lines.length}` : lines.length}
              </span>
            </div>

            {/* ✅ Filtre par statut cliquable — accès rapide */}
            <div className="flex gap-1">
              {(["ALL", "PENDING", "COUNTED", "SKIPPED"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLineFilter(f)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    lineFilter === f
                      ? "border-slate-400 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  }`}
                >
                  {f === "ALL" ? "Tous" : LINE_STATUS_LABELS[f]}
                </button>
              ))}
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Recherche produit…"
              className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Stock théorique</th>
                  <th className="px-4 py-3 text-right">Compté</th>
                  <th className="px-4 py-3 text-right">Écart</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right w-32">Sauvegarde</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      Aucun produit ne correspond.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((l) => {
                    const p = l.product;
                    const saving = savingLineId === l.id;
                    const delta = Number(l.delta ?? 0);
                    const deltaCls =
                      delta === 0
                        ? "text-slate-700 dark:text-slate-200"
                        : delta > 0
                        ? "text-emerald-700 dark:text-emerald-200"
                        : "text-red-700 dark:text-red-200";

                    return (
                      <tr
                        key={l.id}
                        className={`border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/30 ${
                          saving ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{p?.name ?? "—"}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {p?.sku ? `SKU : ${p.sku}` : ""}
                            {p?.unit ? ` · ${p.unit}` : ""}
                            {p?.category?.name ? ` · ${p.category.name}` : ""}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {Number(l.expectedQty ?? 0)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <input
                            disabled={!isDraft || saving}
                            value={l.countedQty === null ? "" : String(l.countedQty)}
                            onChange={(e) => {
                              const v = e.target.value;
                              setInv((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  lines: (prev.lines ?? []).map((x) =>
                                    x.id === l.id ? { ...x, countedQty: v === "" ? null : Number(v) } : x
                                  ),
                                };
                              });
                            }}
                            onBlur={(e) => {
                              if (!isDraft) return;
                              const v = e.target.value.trim();
                              const countedQty = v === "" ? null : Math.max(0, Math.trunc(Number(v)));
                              updateLine(l.id, { countedQty });
                            }}
                            inputMode="numeric"
                            className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm outline-none focus:ring disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            placeholder="—"
                          />
                        </td>

                        <td className={`px-4 py-3 text-right font-semibold tabular-nums ${deltaCls}`}>
                          {delta === 0 ? "0" : delta > 0 ? `+${delta}` : String(delta)}
                        </td>

                        <td className="px-4 py-3">
                          <select
                            disabled={!isDraft || saving}
                            value={l.status}
                            onChange={(e) =>
                              updateLine(l.id, { status: e.target.value as InventoryLineStatus })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="PENDING">En attente</option>
                            <option value="COUNTED">Compté</option>
                            <option value="SKIPPED">Ignoré</option>
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <input
                            disabled={!isDraft || saving}
                            defaultValue={l.note ?? ""}
                            onBlur={(e) =>
                              updateLine(l.id, {
                                note: e.target.value.trim() ? e.target.value.trim() : null,
                              })
                            }
                            placeholder="—"
                            className="w-48 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </td>

                        <td className="px-4 py-3 text-right text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                          {saving ? "Enregistrement…" : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          Clôture
      ============================================================ */}
      {isDraft && lines.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Clôturer l'inventaire</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            La clôture applique les ajustements de stock et verrouille définitivement ce document.
          </div>

          <div className="mt-3">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Note de clôture <span className="text-slate-400">(obligatoire — au moins 3 caractères)</span>
            </label>
            <input
              disabled={!isDraft || posting}
              value={postNote}
              onChange={(e) => setPostNote(e.target.value)}
              placeholder="Ex : Inventaire mensuel validé par le responsable…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* ✅ Explications conditionnelles sur le blocage */}
          {!hasCountedLine && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Au moins une ligne doit être comptée (statut "Compté") avant de pouvoir clôturer.
            </div>
          )}

          {err && posting && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {err}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              disabled={!canPost || posting}
              onClick={onPost}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {/* ✅ Label sans suffixe technique */}
              {posting ? "Clôture en cours…" : "Clôturer l'inventaire"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}