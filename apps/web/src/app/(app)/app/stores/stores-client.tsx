"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

type StoreItem = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  warehouseId: string;
  warehouse?: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    isActive: boolean;
    deletedAt: string | null;
    kind?: "DEPOT" | "STORE";
  } | null;
};

// ✅ Labels métier pour les types d'entrepôt
const KIND_LABELS: Record<"DEPOT" | "STORE", string> = {
  DEPOT: "Dépôt",
  STORE: "Magasin",
};

function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

export default function StoresClient() {
  const router = useRouter();

  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ✅ Confirmation suppression inline — pas de window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Formulaire création
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ✅ Bouton désactivé si champs obligatoires vides
  const canSubmit = useMemo(
    () => code.trim().length > 0 && name.trim().length > 0,
    [code, name]
  );

  async function loadStores() {
    const params = new URLSearchParams({ status, limit: "100" });
    if (q.trim()) params.set("q", q.trim());
    const res = await apiGet<{ items: StoreItem[] }>(`/stores?${params}`);
    setItems(res.items ?? []);
  }

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      await loadStores();
    } catch (e: unknown) {
      setError(getErrMsg(e, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Recherche avec debounce
  useEffect(() => {
    const t = setTimeout(() => { refresh().catch(() => {}); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function resetForm() {
    setCode("");
    setName("");
    setAddress("");
    setIsActive(true);
    setFormError(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setFormError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await apiPost<{ item: StoreItem }>("/stores", {
        code: code.trim(),
        name: name.trim(),
        address: address.trim() || null,
        isActive,
      });
      // ✅ Message de succès explicite
      setSuccess(`Magasin "${res.item?.name ?? name.trim()}" créé.`);
      resetForm();
      await loadStores();
    } catch (e: unknown) {
      setFormError(getErrMsg(e, "Erreur lors de la création"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleStatus(store: StoreItem) {
    setError(null);
    try {
      await apiPatch<{ item: StoreItem }>(`/stores/${store.id}/status`, {
        isActive: !store.isActive,
      });
      await loadStores();
    } catch (e: unknown) {
      setError(getErrMsg(e, "Erreur lors du changement de statut"));
    }
  }

  async function onRemove(store: StoreItem) {
    setRemovingId(store.id);
    setError(null);
    try {
      await apiDelete<{ item: StoreItem }>(`/stores/${store.id}`);
      setConfirmDeleteId(null);
      await loadStores();
    } catch (e: unknown) {
      setError(getErrMsg(e, "Erreur lors de la suppression"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Feedback succès */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Erreur globale */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Formulaire création */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-3">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Créer un magasin
          </div>
          {/* ✅ Description métier sans jargon */}
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Un stock dédié sera créé automatiquement pour ce magasin.
          </div>
        </div>

        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MAG1"
              autoComplete="off"
            />
          </div>

          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Boutique Abidjan"
              autoComplete="off"
            />
          </div>

          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Adresse <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Abidjan, Cocody…"
              autoComplete="off"
            />
          </div>

          <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Disponible dès la création
            </label>

            <div className="flex items-center gap-2">
              {/* ✅ "Réinitialiser" — plus d'anglicisme "Reset" */}
              <button
                type="button"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                onClick={resetForm}
                disabled={submitting}
              >
                Réinitialiser
              </button>
              {/* ✅ CTA clair + désactivé si invalide */}
              <button
                type="submit"
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                disabled={submitting || !canSubmit}
              >
                {submitting ? "Création…" : "Créer le magasin"}
              </button>
            </div>
          </div>

          {formError && (
            <div className="md:col-span-12 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {formError}
            </div>
          )}
        </form>
      </div>

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Compteur pluriel correct */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
            {loading ? "Chargement…" : `${items.length} magasin${items.length > 1 ? "s" : ""}`}
          </div>

          {/* Recherche */}
          <input
            className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (nom ou code)…"
          />

          {/* Filtre statut */}
          <select
            className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "all")}
          >
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="all">Tous</option>
          </select>

          {/* ✅ Filtre "Limite" supprimé — détail d'implémentation sans valeur pour l'opérateur */}

          <button
            type="button"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
            onClick={() => refresh()}
            disabled={loading}
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {q.trim() ? "Aucun magasin ne correspond." : "Aucun magasin."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Magasin</th>
                  <th className="px-4 py-3">Stock associé</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr
                    key={s.id}
                    // ✅ Ligne entière cliquable — bouton "Ouvrir" retiré
                    onClick={() => router.push(`/app/stores/${s.id}`)}
                    className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {s.code} — {s.name}
                      </div>
                      {s.address && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{s.address}</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {s.warehouse ? (
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {s.warehouse.name}
                          </div>
                          {/* ✅ Label métier — pas "Type: STORE" brut */}
                          {s.warehouse.kind && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {KIND_LABELS[s.warehouse.kind]}
                            </div>
                          )}
                        </div>
                      ) : (
                        // ✅ Pas d'UUID brut affiché
                        <span className="text-xs italic text-slate-400 dark:text-slate-500">
                          Non synchronisé
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          s.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                        ].join(" ")}
                      >
                        {s.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div
                        className="flex justify-end gap-2"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                          onClick={() => onToggleStatus(s)}
                        >
                          {/* ✅ "Réactiver" cohérent avec les autres modules */}
                          {s.isActive ? "Désactiver" : "Réactiver"}
                        </button>

                        {/* ✅ Confirmation inline — plus de window.confirm avec "soft delete" */}
                        {confirmDeleteId === s.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              onClick={() => onRemove(s)}
                              disabled={removingId === s.id}
                            >
                              {removingId === s.id ? "Suppression…" : "Confirmer"}
                            </button>
                            <button
                              type="button"
                              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="h-8 rounded-lg border border-red-200 bg-white px-3 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-200"
                            onClick={() => setConfirmDeleteId(s.id)}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
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