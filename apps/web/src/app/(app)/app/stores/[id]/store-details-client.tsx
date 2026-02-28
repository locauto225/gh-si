"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiDelete, apiGet, apiPatch } from "@/lib/api";
import PriceListSelect from "@/components/PriceListSelect";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  deletedAt: string | null;
  kind?: "DEPOT" | "STORE";
  priceListId?: string | null;
};

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
  warehouse?: Warehouse | null;
  priceListId?: string | null;
};

// ✅ Labels métier pour les types d'entrepôt
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

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "muted" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export default function StoreDetailsClient({ id }: { id: string }) {
  const [item, setItem] = useState<StoreItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [removing, setRemoving] = useState(false);
  // ✅ Confirmation inline — plus de window.confirm avec "soft delete"
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [storePriceListId, setStorePriceListId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<{ item: StoreItem }>(`/stores/${id}`);
      setItem(res.item);
      setName(res.item.name ?? "");
      setAddress(res.item.address ?? "");
      setStorePriceListId(res.item.priceListId ?? null);
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
  // ✅ Label depuis état réel — pas de statusLabel string distinct
  const statusTone: "ok" | "muted" = isActive ? "ok" : "muted";

  const kindBadge = useMemo(() => {
    const wh = item?.warehouse;
    if (!wh?.kind) return null;
    const isStore = wh.kind === "STORE";
    return (
      // ✅ Badge avec label métier — pas "STORE" brut
      <Badge tone={isStore ? "ok" : "warn"}>
        {KIND_LABELS[wh.kind]}
      </Badge>
    );
  }, [item]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      const res = await apiPatch<{ item: StoreItem }>(`/stores/${item.id}`, {
        name: name.trim(),
        address: address.trim() || null,
        priceListId: storePriceListId || null,
      });
      setItem(res.item);
      setName(res.item.name ?? "");
      setAddress(res.item.address ?? "");
      setStorePriceListId(res.item.priceListId ?? null);
      setSuccess("Modifications enregistrées.");
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus() {
    if (!item) return;
    setUpdatingStatus(true);
    setErr(null);
    try {
      const res = await apiPatch<{ item: StoreItem }>(`/stores/${item.id}/status`, {
        isActive: !item.isActive,
      });
      setItem(res.item);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors du changement de statut"));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function onRemove() {
    if (!item) return;
    setRemoving(true);
    setErr(null);
    try {
      const res = await apiDelete<{ item: StoreItem }>(`/stores/${item.id}`);
      setItem(res.item);
      setConfirmDelete(false);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Erreur lors de la suppression"));
    } finally {
      setRemoving(false);
    }
  }

  const wh = item?.warehouse ?? null;

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
          {err ?? "Magasin introuvable."}
        </div>
        <Link
          href="/app/stores"
          className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          ← Retour aux magasins
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
          {/* Fil d'Ariane */}
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/app/stores" className="hover:underline">Magasins</Link>
            <span className="mx-0.5">/</span>
            <span className="font-mono">{item.code}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {item.name}
            </h1>
            <Badge tone={statusTone}>{isActive ? "Actif" : "Inactif"}</Badge>
            {/* ✅ Badge "Supprimé" sans "(deleted)" anglais */}
            {item.deletedAt && <Badge tone="muted">Supprimé</Badge>}
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            {item.address ?? <span className="italic">Adresse non renseignée</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Rafraîchir
          </button>

          {/* ✅ Toggle busy label explicite */}
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={!item || updatingStatus || !!item.deletedAt}
            className={`h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-60 ${
              item.isActive
                ? "border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                : "bg-slate-900 text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
            }`}
          >
            {updatingStatus ? "Mise à jour…" : item.isActive ? "Désactiver" : "Réactiver"}
          </button>

          {/* ✅ Confirmation inline — plus de window.confirm */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 dark:text-red-400">Confirmer ?</span>
              <button
                type="button"
                onClick={onRemove}
                disabled={removing}
                className="h-9 rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? "Suppression…" : "Oui, supprimer"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={!!item.deletedAt}
              className="h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-200 dark:hover:bg-red-950/30"
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

      {/* Grille principale */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne gauche — formulaire + liens rapides */}
        <div className="lg:col-span-2 space-y-4">
          {/* Formulaire */}
          <form
            onSubmit={onSave}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Informations
                </div>
              </div>
              <Badge tone={statusTone}>{isActive ? "Actif" : "Inactif"}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-12">
              {/* Code — non modifiable */}
              <div className="md:col-span-3">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Code</label>
                <input
                  value={item.code}
                  disabled
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                />
                {/* ✅ Hint métier — pas "figé (recommandé)" */}
                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Non modifiable après création.
                </div>
              </div>

              {/* Nom */}
              <div className="md:col-span-5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Nom du magasin"
                  required
                />
              </div>

              {/* Adresse */}
              <div className="md:col-span-4">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Adresse <span className="font-normal text-slate-400">(optionnel)</span>
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Abidjan, Cocody…"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Tarif */}
              <div className="md:col-span-6">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Tarif par défaut
                </label>
                <div className="mt-1">
                  <PriceListSelect
                    value={storePriceListId}
                    onChange={setStorePriceListId}
                    disabled={!!item.deletedAt}
                  />
                </div>
                {/* ✅ Hint métier — pas "channel STORE" */}
                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Utilisé pour pré-remplir les prix de vente en magasin.
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {/* ✅ Dates avec fmtDate — format cohérent */}
              <div className="text-xs text-slate-400 dark:text-slate-500">
                Créé le {fmtDate(item.createdAt)} · Modifié le {fmtDate(item.updatedAt)}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={load}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                >
                  Annuler
                </button>
                {/* ✅ Busy label explicite */}
                <button
                  disabled={saving || !!item.deletedAt}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </form>

          {/* Liens rapides */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
            <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              Accès rapide
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/app/stock?warehouseId=${encodeURIComponent(item.warehouseId)}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Stock
              </Link>
              <Link
                href={`/app/stock/transfers?warehouseId=${encodeURIComponent(item.warehouseId)}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Transferts
              </Link>
              <Link
                href={`/app/stock/inventory?warehouseId=${encodeURIComponent(item.warehouseId)}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Inventaire
              </Link>
              <Link
                href={`/app/sales?storeId=${item.id}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Ventes
              </Link>
              <Link
                href="/app/invoices"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                Factures
              </Link>
            </div>
            {/* ✅ Note dev supprimée */}
          </div>
        </div>

        {/* Colonne droite — entrepôt associé */}
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Stock associé
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Entrepôt dédié à ce magasin.
                </div>
              </div>
              {/* ✅ Badge avec label métier — pas "Stock: STORE" brut */}
              {kindBadge}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              {wh ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">Nom</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-right">
                      {wh.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">Code</span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{wh.code}</span>
                  </div>
                  {wh.address && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Adresse</span>
                      <span className="text-right text-slate-700 dark:text-slate-200">{wh.address}</span>
                    </div>
                  )}
                  {/* ✅ "Tarif dépôt (warehouse)" remplacé par label métier */}
                  {wh.priceListId && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Tarif</span>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                        {wh.priceListId}
                      </span>
                    </div>
                  )}
                  <div className="pt-1">
                    <Badge tone={wh.isActive && !wh.deletedAt ? "ok" : "muted"}>
                      {wh.isActive && !wh.deletedAt ? "Actif" : "Inactif"}
                    </Badge>
                    {/* ✅ Plus de "(deleted)" en anglais */}
                    {wh.deletedAt && (
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">Supprimé</span>
                    )}
                  </div>
                </>
              ) : (
                // ✅ Pas de note dev "L'API ne renvoie pas `warehouse`..."
                <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                  Informations non disponibles.
                </div>
              )}
            </div>

            <div className="mt-4">
              <Link
                href={`/app/stock?warehouseId=${encodeURIComponent(item.warehouseId)}`}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
              >
                Voir le stock
              </Link>
            </div>
          </div>

          {/* ✅ Bloc "Conseil UX" supprimé — note dev non destinée à l'opérateur */}
        </div>
      </div>
    </div>
  );
}