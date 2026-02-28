"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, apiGet, apiPost } from "@/lib/api";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "active" | "inactive" | "all";
type KindFilter = "DEPOT" | "STORE" | "all";

function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

export default function WarehousesClient() {
  const router = useRouter();
  const [items, setItems] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // ✅ Message de succès
  const [success, setSuccess] = useState<string | null>(null);

  // ✅ Filtre kind par défaut "all" — pas de vue filtrée silencieuse à l'arrivée
  const [status, setStatus] = useState<StatusFilter>("active");
  const [kind, setKind] = useState<KindFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Formulaire
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalizedCode = useMemo(
    () => code.trim().toUpperCase().replace(/\s+/g, "_"),
    [code]
  );

  // ✅ Désactivation si champs obligatoires vides
  const canSubmit = code.trim().length > 0 && name.trim().length > 0;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ status });
      if (kind !== "all") params.set("kind", kind);
      const res = await apiGet<{ items: Warehouse[] }>(`/warehouses?${params}`);
      setItems(res.items ?? []);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du chargement"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, kind]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ item: Warehouse }>("/warehouses", {
        code: normalizedCode,
        name: name.trim(),
        address: address.trim() || null,
        isActive,
      });

      // ✅ Succès explicite
      setSuccess(`Entrepôt "${res.item?.name ?? name.trim()}" créé.`);

      setCode("");
      setName("");
      setAddress("");
      setIsActive(true);
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la création"));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus(w: Warehouse) {
    setUpdatingId(w.id);
    setErr(null);
    try {
      await apiFetch(`/warehouses/${w.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !w.isActive }),
      });
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la mise à jour du statut"));
    } finally {
      setUpdatingId(null);
    }
  }

  const hasActiveFilters = status !== "active" || kind !== "all";

  return (
    <div className="space-y-4">
      {/* Feedback succès */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Formulaire */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          Ajouter un entrepôt
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          {/* Code */}
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PRINCIPAL"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              required
            />
            {normalizedCode && (
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Sera enregistré : <span className="font-mono">{normalizedCode}</span>
              </div>
            )}
          </div>

          {/* Nom */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrepôt principal"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              required
            />
          </div>

          {/* Adresse */}
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Adresse <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Abidjan, Cocody…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            Disponible dès la création
          </label>

          {/* ✅ Bouton désactivé + CTA clair */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? "Création…" : "Ajouter l'entrepôt"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </form>

      {/* Liste */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
          {/* ✅ Titre descriptif avec compteur */}
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mr-auto">
            {loading ? "Chargement…" : `${items.length} entrepôt${items.length > 1 ? "s" : ""}`}
          </div>

          {/* Filtre type */}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            {/* ✅ "Tous les types" par défaut explicite */}
            <option value="all">Tous les types</option>
            <option value="DEPOT">Dépôts</option>
            <option value="STORE">Magasins</option>
          </select>

          {/* Filtre statut */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="all">Tous</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setStatus("active"); setKind("all"); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Réinitialiser
            </button>
          )}

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {status === "inactive"
              ? "Aucun entrepôt inactif."
              : status === "all"
              ? "Aucun entrepôt pour ce filtre."
              : "Aucun entrepôt actif pour l'instant."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-slate-100">
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Adresse</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr
                    key={w.id}
                    // ✅ Ligne entière cliquable
                    onClick={() => router.push(`/app/warehouses/${w.id}`)}
                    className="cursor-pointer border-t border-slate-200 odd:bg-slate-50/40 hover:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-950/20 dark:hover:bg-slate-950/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {w.code}
                    </td>
                    <td className="px-4 py-3 font-medium">{w.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {w.address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          w.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
                        }`}
                      >
                        {w.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); onToggleStatus(w); }}
                        disabled={updatingId === w.id}
                        className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${
                          w.isActive
                            ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                            : "bg-slate-900 font-medium text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
                        }`}
                      >
                        {/* ✅ Busy label explicite */}
                        {updatingId === w.id
                          ? "Mise à jour…"
                          : w.isActive
                          ? "Désactiver"
                          : "Réactiver"}
                      </button>
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