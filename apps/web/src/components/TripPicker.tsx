"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

export type TripPickerTrip = {
  id: string;
  number: string;
  status: "DRAFT" | "LOADED" | "IN_PROGRESS" | "DONE" | "CLOSED" | "CANCELLED";
  fromWarehouse?: { id: string; code: string; name: string } | null;
  driver?: { id: string; name: string } | null;
};

export function TripPicker({
  value,
  onChange,
  allowedStatuses = ["DRAFT", "LOADED", "IN_PROGRESS"],
}: {
  value: TripPickerTrip | null;
  onChange: (v: TripPickerTrip | null) => void;
  allowedStatuses?: TripPickerTrip["status"][];
}) {
  const [items, setItems] = useState<TripPickerTrip[]>([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = items.filter((t) => allowedStatuses.includes(t.status));
    if (!s) return base;
    return base.filter((t) => t.number.toLowerCase().includes(s));
  }, [items, q, allowedStatuses]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ items: TripPickerTrip[] }>("/delivery-trips?limit=200");
        setItems(res.items ?? []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une tournée…"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
      />

      <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          — Aucune —
        </button>

        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t)}
            className={[
              "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900",
              value?.id === t.id ? "bg-slate-50 dark:bg-slate-900" : "",
            ].join(" ")}
          >
            <div className="font-medium">{t.number}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t.status} • {t.fromWarehouse?.code ?? "—"} • {t.driver?.name ?? "—"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}