"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiDelete, apiGet, apiPatch } from "@/lib/api";
import PriceListSelect from "@/components/PriceListSelect";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  kind?: "DEPOT" | "STORE";
  priceListId?: string | null;
  priceList?: { id: string; code: string; name: string } | null;
  store?: { id: string; code: string; name: string } | null;
};

// ✅ Labels métier pour les types
const KIND_LABELS: Record<"DEPOT" | "STORE", string> = {
  DEPOT: "Dépôt",
  STORE: "Magasin",
};

function fmtDate(dt: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return dt;
  }
}

function getErrMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? fallback;
}

export default function WarehouseDetailsClient({ id }: { id: string }) {
  const [item, setItem] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // ✅ Confirmation de suppression explicite sans window.confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [priceListId, setPriceListId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: Warehouse }>(`/warehouses/${id}`);
      setItem(res.item);
      setName(res.item.name ?? "");
      setAddress(res.item.address ?? "");
      setPriceListId(res.item.priceListId ?? null);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du chargement"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isActive = !!(item?.isActive && !item?.deletedAt);

  const statusBadge = useMemo(() => {
    if (!item) return null;
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
          isActive
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
        }`}
      >
        {isActive ? "Actif" : "Inactif"}
      </span>
    );
  }, [item, isActive]);

  const kindBadge = useMemo(() => {
    if (!item?.kind) return null;
    const isStore = item.kind === "STORE";
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
          isStore
            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200"
            : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200"
        }`}
      >
        {KIND_LABELS[item.kind]}
      </span>
    );
  }, [item]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      const res = await apiPatch<{ item: Warehouse }>(`/warehouses/${item.id}`, {
        name: name.trim(),
        address: address.trim() || null,
        priceListId: priceListId || null,
      });
      setItem(res.item);
      setName(res.item.name ?? "");
      setAddress(res.item.address ?? "");
      setPriceListId(res.item.priceListId ?? null);
      setSuccess("Modifications enregistrées.");
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus() {
    if (!item) return;
    setToggling(true);
    setErr(null);
    try {
      const res = await apiPatch<{ item: Warehouse }>(`/warehouses/${item.id}/status`, {
        isActive: !item.isActive,
      });
      setItem(res.item);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la mise à jour du statut"));
    } finally {
      setToggling(false);
    }
  }

  async function onRemove() {
    if (!item) return;
    setRemoving(true);
    setErr(null);
    try {
      const res = await apiDelete<{ item: Warehouse }>(`/warehouses/${item.id}`);
      setItem(res.item);
      setConfirmDelete(false);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la suppression"));
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
        Chargement…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err ?? "Entrepôt introuvable."}
        </div>
        <Link
          href="/app/warehouses"
          className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          ← Retour aux entrepôts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Feedback */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <Link href="/app/warehouses" className="hover:underline">
              Entrepôts
            </Link>{" "}
            <span className="mx-1">/</span>
            <span className="font-mono">{item.code}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {item.name}
            </h1>
            {statusBadge}
            {kindBadge}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300">
            {item.address ?? <span className="italic text-slate-400">Adresse non renseignée</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ✅ Busy labels explicites */}
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={toggling}
            className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
              item.isActive
                ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                : "bg-slate-900 text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
            }`}
          >
            {toggling ? "Mise à jour…" : item.isActive ? "Désactiver" : "Réactiver"}
          </button>

          {/* ✅ Confirmation inline — plus de window.confirm avec jargon "soft delete" */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 dark:text-red-400">Confirmer ?</span>
              <button
                type="button"
                onClick={onRemove}
                disabled={removing}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? "Suppression…" : "Oui, supprimer"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/30"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      {/* Grille */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Formulaire infos */}
        <form
          onSubmit={onSave}
          className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
        >
          <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            Informations
          </div>

          <div className="grid gap-3 md:grid-cols-6">
            {/* Code — non modifiable */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Code</label>
              <input
                value={item.code}
                disabled
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
              />
              {/* ✅ Pas de "identifiant technique" — juste ce que l'utilisateur doit savoir */}
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Non modifiable après création.
              </div>
            </div>

            {/* Nom */}
            <div className="md:col-span-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                required
              />
            </div>

            {/* Adresse */}
            <div className="md:col-span-6">
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

            {/* Tarif */}
            <div className="md:col-span-6">
              <PriceListSelect
                label="Tarif par défaut"
                value={priceListId}
                onChange={setPriceListId}
                status="active"
                allowNone
              />
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Utilisé pour calculer les prix de vente. Si absent, le tarif global s'applique.
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              Annuler
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>

          {/* Dates — format cohérent avec le reste de l'ERP */}
          <div className="mt-4 grid gap-1 text-xs text-slate-400 dark:text-slate-500 sm:grid-cols-2">
            <div>Créé le {fmtDate(item.createdAt)}</div>
            <div>Modifié le {fmtDate(item.updatedAt)}</div>
          </div>
        </form>

        {/* Liens rapides + paramètres */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            Accès rapide
          </div>

          {/* ✅ Liens sans "(filtré)" répété — le contexte suffit */}
          <div className="space-y-1.5">
            <Link
              href={`/app/stock?warehouseId=${item.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              <span>Stock</span>
              <span className="text-xs text-slate-400">→</span>
            </Link>
            <Link
              href={`/app/stock/transfers?warehouseId=${item.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              <span>Transferts</span>
              <span className="text-xs text-slate-400">→</span>
            </Link>
            <Link
              href={`/app/purchases?warehouseId=${item.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              <span>Achats</span>
              <span className="text-xs text-slate-400">→</span>
            </Link>
            <Link
              href={`/app/sales?warehouseId=${item.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            >
              <span>Ventes</span>
              <span className="text-xs text-slate-400">→</span>
            </Link>
          </div>

          {/* Paramètres affichés en clair */}
          {(item.kind || item.priceList || item.priceListId || item.store) && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Paramètres
              </div>

              {item.kind && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Type</span>
                  {/* ✅ Label métier, pas DEPOT/STORE brut */}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {KIND_LABELS[item.kind]}
                  </span>
                </div>
              )}

              {(item.priceList || item.priceListId) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Tarif</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {item.priceList?.name ?? item.priceList?.code ?? item.priceListId ?? "—"}
                  </span>
                </div>
              )}

              {item.store && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Magasin lié</span>
                  <Link
                    href={`/app/stores/${item.store.id}`}
                    className="font-medium text-slate-900 underline hover:opacity-80 dark:text-slate-100"
                  >
                    {item.store.name ?? item.store.code}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}