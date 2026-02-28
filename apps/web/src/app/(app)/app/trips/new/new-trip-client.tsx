"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { DriverPicker } from "@/components/DriverPicker";

type Warehouse = { id: string; code: string; name: string };
type Driver = { id: string; name: string; phone?: string | null };

export default function NewTripClient() {
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ items: Warehouse[] }>("/warehouses?status=active&limit=200");
        setWarehouses(res.items ?? []);
      } catch {
        setWarehouses([]);
      }
    })();
  }, []);

  async function onCreate() {
    setErr(null);
    if (!fromWarehouseId) {
      setErr("Choisis l'entrepôt de départ.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost<{ item: { id: string } }>("/delivery-trips", {
        fromWarehouseId,
        driverId: driver?.id ?? null,
        note: note.trim() || null,
      });
      router.push(`/app/trips/${res.item.id}`);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Erreur lors de la création de la tournée");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nouvelle tournée</div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Choisis l'entrepôt de départ et le livreur. Les arrêts s'ajoutent ensuite depuis la fiche.
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Entrepôt de départ <span className="text-red-500">*</span>
            </label>
            <select
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">— Choisir un entrepôt</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Livreur <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <div className="mt-1">
              <DriverPicker value={driver} onChange={setDriver} />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Note <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Ex : livraisons zone nord…"
            />
          </div>

          <div className="md:col-span-12 flex justify-end">
            <button
              type="button"
              disabled={saving || !fromWarehouseId}
              onClick={onCreate}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {/* ✅ CTA clair + busy label explicite */}
              {saving ? "Création…" : "Créer la tournée"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}