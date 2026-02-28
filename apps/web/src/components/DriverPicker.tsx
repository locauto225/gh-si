"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

export type DriverPickerDriver = { id: string; name: string; phone?: string | null };

export function DriverPicker({
  value,
  onChange,
}: {
  value: DriverPickerDriver | null;
  onChange: (v: DriverPickerDriver | null) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<DriverPickerDriver[]>([]);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) => d.name.toLowerCase().includes(s));
  }, [items, q]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<{ items: DriverPickerDriver[] }>("/drivers?status=active&limit=200");
        setItems(res.items ?? []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
      >
        {value ? value.name : "—"}
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
          />
          <div className="mt-2 max-h-56 overflow-auto">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              — Aucun —
            </button>

            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <span className="font-medium">{d.name}</span>
                {d.phone ? <span className="ml-2 text-xs text-slate-500">{d.phone}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}