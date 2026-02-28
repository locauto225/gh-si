"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";

export type WarehouseKind = "DEPOT" | "STORE";

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
  kind: WarehouseKind;
  isActive: boolean;
};

function getErrMsg(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as any).message);
  return "Erreur";
}

export function WarehouseScopeSelect({
  label = "Lieu",
  value,
  onChange,

  kind,
  onKindChange,

  disabled,
  required,
  placeholder = "— Choisir —",

  // éviter de proposer un lieu (ex: même id que "from")
  excludeIds,

  // UX
  hint,
  autoSelectFirst = true,

  // API
  status = "active",
  limit = 200,
  className,
}: {
  label?: string;

  value: string;
  onChange: (warehouseId: string) => void;

  kind: WarehouseKind;
  onKindChange: (kind: WarehouseKind) => void;

  disabled?: boolean;
  required?: boolean;
  placeholder?: string;

  excludeIds?: string[];

  hint?: string;
  autoSelectFirst?: boolean;

  status?: "active" | "inactive" | "all";
  limit?: number;

  className?: string;
}) {
  const [all, setAll] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // IMPORTANT: kind=all pour récupérer DEPOT + STORE en une fois
        const params = new URLSearchParams();
        params.set("status", status);
        params.set("kind", "all");
        params.set("limit", String(Math.max(1, Math.min(200, limit))));

        const res = await apiGet<{ items: WarehouseOption[] }>(`/warehouses?${params.toString()}`);
        if (!mounted) return;

        const items = (res.items ?? []).map((w: any) => ({
          id: String(w.id),
          code: String(w.code ?? ""),
          name: String(w.name ?? ""),
          kind: (w.kind as WarehouseKind) ?? "DEPOT",
          isActive: Boolean(w.isActive ?? true),
        }));

        // Tri stable: DEPOT puis STORE, puis nom
        items.sort((a, b) => {
          const ak = a.kind === "DEPOT" ? 0 : 1;
          const bk = b.kind === "DEPOT" ? 0 : 1;
          if (ak !== bk) return ak - bk;
          return (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" });
        });

        setAll(items);
      } catch (e: unknown) {
        if (!mounted) return;
        setAll([]);
        setErr(getErrMsg(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [status, limit]);

  const excludeSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const options = useMemo(() => {
    return all.filter((w) => w.kind === kind && !excludeSet.has(w.id));
  }, [all, kind, excludeSet]);

  const selected = useMemo(() => {
    return all.find((w) => w.id === value) ?? null;
  }, [all, value]);

  // Si la valeur actuelle ne correspond plus au kind (ou est exclue), on recale
  useEffect(() => {
    if (!autoSelectFirst) return;

    // si pas de value => on met le 1er dispo
    if (!value) {
      const first = options[0];
      if (first?.id) onChange(first.id);
      return;
    }

    // si value invalide pour le kind courant => 1er dispo
    const ok = options.some((w) => w.id === value);
    if (!ok) {
      const first = options[0];
      onChange(first?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, options.length, autoSelectFirst]);

  return (
    <div className={["space-y-1", className ?? ""].join(" ")}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-600 dark:text-slate-300">{label}</label>
        {loading ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Chargement…</span>
        ) : err ? (
          <span className="text-[11px] text-red-600 dark:text-red-300">{err}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={kind}
          onChange={(e) => onKindChange(e.target.value as WarehouseKind)}
          disabled={disabled}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="DEPOT">Entrepôt</option>
          <option value="STORE">Magasin</option>
        </select>

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">{placeholder}</option>
          {options.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code})
            </option>
          ))}
        </select>
      </div>

      {hint ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>
      ) : selected ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Sélection : <span className="text-slate-700 dark:text-slate-200">{selected.name}</span>{" "}
          <span className="text-slate-400 dark:text-slate-500">({selected.code})</span>
        </div>
      ) : null}

      {!loading && !err && options.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Aucun {kind === "DEPOT" ? "entrepôt" : "magasin"} disponible.
        </div>
      ) : null}
    </div>
  );
}