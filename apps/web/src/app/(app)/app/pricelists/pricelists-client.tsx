"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";

type PriceListListItem = {
  id: string;
  code: string;
  name: string;
  note: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
};

type StatusFilter = "active" | "inactive" | "all";

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

export default function PricelistsClient() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");

  const [items, setItems] = useState<PriceListListItem[]>([]);
  const [loading, setLoading] = useState(true);
  // ✅ Erreurs séparées
  const [errList, setErrList] = useState<string | null>(null);
  const [errForm, setErrForm] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulaire création
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  // ✅ Bouton désactivé si incomplet
  const canSubmit = useMemo(
    () => code.trim().length > 0 && name.trim().length > 0,
    [code, name]
  );

  const query = useMemo(() => {
    const sp = new URLSearchParams({ status, limit: "100" });
    if (q.trim()) sp.set("q", q.trim());
    return `?${sp}`;
  }, [q, status]);

  async function load() {
    setLoading(true);
    setErrList(null);
    try {
      const res = await apiGet<{ items: PriceListListItem[] }>(`/pricelists${query}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErrList(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function resetForm() {
    setCode("");
    setName("");
    setNote("");
    setErrForm(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrForm(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ item: PriceListListItem }>("/pricelists", {
        code: code.trim(),
        name: name.trim(),
        note: note.trim() || null,
        isActive: true,
      });
      // ✅ Message de succès
      setSuccess(`Grille tarifaire "${res.item?.name ?? name.trim()}" créée.`);
      resetForm();
      // Ajouter en tête de liste sans rechargement complet
      setItems((prev) => [res.item, ...prev]);
    } catch (e: unknown) {
      setErrForm(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tarifs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Grilles tarifaires par canal de vente. Les prix par produit sont définis dans chaque grille.
          </p>
        </div>
      </div>

      {/* Feedback succès */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Formulaire création */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Nouvelle grille tarifaire
        </div>
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Code <span className="text-red-500">*</span>
            </label>
            {/* ✅ Placeholder exemple métier — pas de "TARIF_DEPOT" technique */}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="DEPOT, MAGASIN, PROMO…"
              required
            />
          </div>
          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Tarif Dépôt"
              required
            />
          </div>
          <div className="md:col-span-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Note <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Commentaire…"
            />
          </div>

          <div className="md:col-span-12 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              Réinitialiser
            </button>
            {/* ✅ CTA explicite */}
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {saving ? "Création…" : "Créer la grille"}
            </button>
          </div>
        </form>

        {errForm && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {errForm}
          </div>
        )}
      </div>

      {/* Erreur liste */}
      {errList && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {errList}
        </div>
      )}

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Compteur + pluriel correct */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
            {loading
              ? "Chargement…"
              : `${items.length} grille${items.length > 1 ? "s" : ""} tarifaire${items.length > 1 ? "s" : ""}`}
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Rechercher…"
          />

          {/* ✅ Filtre "Limite" supprimé — fixé à 100 en interne */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
            <option value="all">Toutes</option>
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {q.trim() ? "Aucune grille ne correspond." : "Aucune grille tarifaire."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((pl) => (
              <div
                key={pl.id}
                // ✅ Ligne cliquable
                onClick={() => router.push(`/app/pricelists/${pl.id}`)}
                className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-950/30"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {pl.name}
                    </div>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      {pl.code}
                    </span>
                    {/* ✅ Badge "Inactive" en français */}
                    {!pl.isActive && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  {pl.note && (
                    <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {pl.note}
                    </div>
                  )}
                  {/* ✅ "produit(s)" en français — plus de "Items" */}
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {pl._count?.items ?? 0} produit{(pl._count?.items ?? 0) > 1 ? "s" : ""} tarifé{(pl._count?.items ?? 0) > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      router.push(`/app/pricelists/${pl.id}`);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    Ouvrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}