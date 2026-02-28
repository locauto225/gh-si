"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ApiError, apiPost } from "@/lib/api";

type Store = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  warehouseId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function getErrMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inattendue";
}

export default function NewStoreClient() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => code.trim().length > 0 && name.trim().length > 0,
    [code, name]
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setSaving(true);
    try {
      const res = await apiPost<{ item: Store }>("/stores", {
        code: code.trim(),
        name: name.trim(),
        address: address.trim() || null,
        isActive,
      });
      router.push(`/app/stores/${res.item.id}`);
    } catch (e2: unknown) {
      setErr(getErrMsg(e2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/app/stores"
              className="text-slate-500 hover:underline dark:text-slate-400"
            >
              Magasins
            </Link>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">Nouveau</span>
          </div>
          {/* ✅ Description métier sans jargon */}
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Un stock dédié sera créé automatiquement pour ce magasin.
          </div>
        </div>

        <Link
          href="/app/stores"
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
        >
          ← Retour
        </Link>
      </div>

      {/* Formulaire */}
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="mb-4 text-sm font-medium text-slate-900 dark:text-slate-100">
          Informations
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          {/* Code */}
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MAG1"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {/* ✅ Hint métier — pas "exports / intégrations" */}
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Identifiant court, non modifiable après création.
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
              placeholder="Magasin Plateau"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Adresse */}
          <div className="md:col-span-12">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Adresse <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Abidjan, Cocody…"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Statut */}
          <div className="md:col-span-12">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
              />
              Disponible dès la création
            </label>
            {/* ✅ Hint métier — pas de "soft delete cohérent côté API" */}
            {!isActive && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Le magasin sera créé inactif et ne sera pas disponible à la vente.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Link
            href="/app/stores"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            Annuler
          </Link>
          {/* ✅ CTA clair + désactivé si invalide */}
          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {/* ✅ "Création…" avec ellipse correcte */}
            {saving ? "Création…" : "Créer le magasin"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </form>
    </div>
  );
}