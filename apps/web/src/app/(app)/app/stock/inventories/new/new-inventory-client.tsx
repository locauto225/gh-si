"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { WarehouseScopeSelect, type WarehouseKind } from "@/components/WarehouseScopeSelect";

type InventoryMode = "FULL" | "CATEGORY" | "FREE";
type Category = { id: string; name: string; slug?: string | null };

function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return "Erreur";
}

// Données des modes — centralisées
const MODES: Array<{
  value: InventoryMode;
  label: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
}> = [
  {
    value: "FULL",
    label: "Complet",
    description: "Tous les produits du lieu.",
  },
  {
    value: "CATEGORY",
    label: "Par catégorie",
    description: "Sélectionne une catégorie à inventorier.",
  },
  {
    value: "FREE",
    label: "Libre",
    description: "Ajout manuel produit par produit.",
    // ✅ Mode désactivé explicitement — pas de confusion UI
    disabled: true,
    disabledReason: "Mode en cours de développement, non disponible.",
  },
];

export default function NewInventoryClient() {
  const router = useRouter();

  const [kind, setKind] = useState<WarehouseKind>("DEPOT");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [mode, setMode] = useState<InventoryMode>("FULL");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!warehouseId) return false;
    if (mode === "CATEGORY" && !categoryId) return false;
    if (mode === "FREE") return false;
    return true;
  }, [warehouseId, mode, categoryId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setCatLoading(true);
      try {
        const res = await apiGet<{ items: Category[] }>("/categories");
        if (!mounted) return;
        setCategories(res.items ?? []);
      } catch {
        if (!mounted) return;
        setCategories([]);
      } finally {
        if (mounted) setCatLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (mode !== "CATEGORY") setCategoryId("");
  }, [mode]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!warehouseId) return setErr("Choisis un lieu.");
    if (mode === "CATEGORY" && !categoryId) return setErr("Choisis une catégorie.");

    setSaving(true);
    try {
      const res = await apiPost<{ item: { id: string } }>("/stock/inventories", {
        warehouseId,
        mode,
        categoryId: mode === "CATEGORY" ? categoryId : null,
        note: note.trim() ? note.trim() : null,
      });

      const id = res?.item?.id;
      if (!id) { setErr("Réponse API invalide."); return; }
      router.push(`/app/stock/inventories/${id}`);
    } catch (e2: unknown) {
      setErr(getErrMsg(e2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onCreate}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="grid gap-4 md:grid-cols-12">

          {/* Lieu */}
          <div className="md:col-span-6">
            <WarehouseScopeSelect
              label="Type + lieu"
              kind={kind}
              onKindChange={(k) => { setKind(k); setWarehouseId(""); }}
              value={warehouseId}
              onChange={setWarehouseId}
              hint="Choisis d'abord Entrepôt ou Magasin, puis le lieu."
              status="active"
              limit={200}
            />
          </div>

          {/* Mode */}
          <div className="md:col-span-6">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Mode d'inventaire</label>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => {
                const isSelected = mode === m.value;
                return (
                  // ✅ Boutons désactivés pour FREE — pas de confusion
                  <button
                    key={m.value}
                    type="button"
                    disabled={m.disabled}
                    onClick={() => !m.disabled && setMode(m.value)}
                    title={m.disabled ? m.disabledReason : undefined}
                    className={[
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      m.disabled
                        ? "cursor-not-allowed opacity-40 border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                        : isSelected
                        ? "border-slate-400 bg-slate-50 text-slate-900 ring-1 ring-slate-300 dark:border-slate-600 dark:bg-slate-950/30 dark:text-slate-100 dark:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-950/30",
                    ].join(" ")}
                  >
                    <div className="font-medium">
                      {m.label}
                      {m.disabled && <span className="ml-1 text-[10px] font-normal text-slate-400">Bientôt</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{m.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Catégorie — visible uniquement si mode CATEGORY */}
            {mode === "CATEGORY" && (
              <div className="mt-3">
                <label className="text-xs text-slate-600 dark:text-slate-300">
                  Catégorie <span className="text-slate-400">(obligatoire)</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">{catLoading ? "Chargement…" : "— Choisir —"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="md:col-span-12">
            <label className="text-xs text-slate-600 dark:text-slate-300">Note (optionnel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : Inventaire mensuel, contrôle qualité…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* ✅ Pas de mention DRAFT en brut */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            L'inventaire sera créé en brouillon — les lignes seront générées à l'étape suivante.
          </div>

          <button
            disabled={saving || !canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? "Création…" : "Créer l'inventaire"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {err}
          </div>
        )}
      </form>

      {/* Guide des étapes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Comment ça marche</div>
        <ol className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">1</span>
            <span>Crée l'inventaire en choisissant le lieu et le mode.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">2</span>
            <span>Génère automatiquement la liste des produits à compter.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">3</span>
            <span>Saisis les quantités comptées, puis clôture pour appliquer les ajustements.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}