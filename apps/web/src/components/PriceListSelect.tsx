"use client";

import * as React from "react";
import { API_URL, apiGet } from "@/lib/api";

type StatusFilter = "active" | "inactive" | "all";

export type PriceListOption = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

type Props = {
  /** id de la grille sélectionnée (ou null si non assigné) */
  value: string | null | undefined;
  /** callback quand l’utilisateur change la sélection */
  onChange: (nextId: string | null) => void;

  /** UI */
  label?: string;
  disabled?: boolean;
  className?: string;

  /** Données */
  status?: StatusFilter; // default: "active"
  limit?: number; // default: 200
  q?: string; // optionnel (si tu veux filtrer)
  /** Endpoint API (par défaut: "/pricelists") */
  endpoint?: string;

  /** Si true, propose une option "— Aucune —" */
  allowNone?: boolean;
  noneLabel?: string;

  /** Texte quand on charge / en erreur */
  loadingLabel?: string;
  errorLabel?: string;
};

function buildRelativePath(endpoint: string, params: Record<string, string | number | undefined>) {
  const url = new URL(endpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    url.searchParams.set(k, String(v));
  });
  return url.pathname + (url.search ? url.search : "");
}

function buildAbsoluteApiUrl(endpoint: string, params: Record<string, string | number | undefined>) {
  // Si endpoint est déjà absolu, on le garde.
  const base = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    url.searchParams.set(k, String(v));
  });
  return url.toString();
}

export default function PriceListSelect({
  value,
  onChange,
  label = "Grille tarifaire",
  disabled,
  className,
  status = "active",
  limit = 200,
  q,
  endpoint = "/pricelists",
  allowNone = true,
  noneLabel = "— Aucune —",
  loadingLabel = "Chargement…",
  errorLabel = "Erreur de chargement",
}: Props) {
  const [items, setItems] = React.useState<PriceListOption[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const path = React.useMemo(
    () => buildRelativePath(endpoint, { status, limit, q }),
    [endpoint, status, limit, q]
  );

  const absoluteUrl = React.useMemo(
    () => buildAbsoluteApiUrl(endpoint, { status, limit, q }),
    [endpoint, status, limit, q]
  );

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        // ✅ Appeler l’API (4000) via helper commun (évite le 404 Next 3000)
        let json: any = null;

        try {
          json = await apiGet<any>(path);
        } catch (err: any) {
          // Fallback très robuste: si le helper échoue (ex: proxy/dev), on tente un fetch absolu
          const res = await fetch(absoluteUrl);
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(txt || `HTTP ${res.status}`);
          }

          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) {
            const txt = await res.text().catch(() => "");
            throw new Error(txt || "Réponse non JSON (vérifie la route API)"
            );
          }

          json = await res.json();
        }

        const list = Array.isArray(json?.items) ? json.items : [];

        const normalized: PriceListOption[] = list
          .filter((x: any) => x && typeof x === "object")
          .map((x: any) => ({
            id: String(x.id),
            code: String(x.code ?? ""),
            name: String(x.name ?? ""),
            isActive: typeof x.isActive === "boolean" ? x.isActive : undefined,
          }))
          .filter((x: PriceListOption) => Boolean(x.id && x.code && x.name));

        if (!cancelled) setItems(normalized);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [path, absoluteUrl]);

  const currentValue = value ?? "";

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <div className="mt-1">
        <select
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          value={currentValue}
          disabled={disabled || loading}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next ? next : null);
          }}
        >
          {allowNone && <option value="">{noneLabel}</option>}

          {loading && (
            <option value="" disabled>
              {loadingLabel}
            </option>
          )}

          {!loading && error && (
            <option value="" disabled>
              {errorLabel}
            </option>
          )}

          {!loading &&
            !error &&
            items.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.code} — {pl.name}
              </option>
            ))}
        </select>

        {error ? (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}