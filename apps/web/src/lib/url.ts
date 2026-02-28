// apps/web/src/lib/url.ts
// Helper réutilisable pour mettre à jour les search params proprement (Next App Router)

export type SearchParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type UpdateSearchParamsOptions = {
  /**
   * Paramètres à supprimer quand la valeur est vide ("" / null / undefined).
   * Par défaut: true.
   */
  removeEmpty?: boolean;

  /**
   * Tri des clés dans l’URL pour stabilité (diff propre).
   * Par défaut: true.
   */
  sortKeys?: boolean;
};

function isEmptyValue(v: unknown) {
  return v === "" || v === null || v === undefined;
}

function normalizeToStrings(v: SearchParamValue): string[] {
  if (Array.isArray(v)) {
    return v
      .flatMap((x) => normalizeToStrings(x as any))
      .filter((s) => s.length > 0);
  }
  if (v === null || v === undefined) return [];
  if (typeof v === "boolean") return [v ? "1" : "0"];
  const s = String(v).trim();
  return s ? [s] : [];
}

/**
 * Met à jour les search params d’une URL (string) en conservant le pathname.
 *
 * - Supprime les clés si valeur vide (par défaut)
 * - Supporte les valeurs multiples (array)
 * - Retourne une string d’URL relative (ex: "/app/stock/transfers?status=DRAFT")
 */
export function updateSearchParams(
  pathname: string,
  currentSearch: string | URLSearchParams,
  patch: Record<string, SearchParamValue>,
  opts: UpdateSearchParamsOptions = {}
) {
  const removeEmpty = opts.removeEmpty ?? true;
  const sortKeys = opts.sortKeys ?? true;

  const sp =
    typeof currentSearch === "string"
      ? new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch)
      : new URLSearchParams(currentSearch);

  for (const [key, value] of Object.entries(patch)) {
    // Reset key then apply next value(s)
    sp.delete(key);

    if (removeEmpty && isEmptyValue(value)) {
      continue;
    }

    const vals = normalizeToStrings(value);
    if (vals.length === 0) {
      if (!removeEmpty) sp.set(key, "");
      continue;
    }

    // Multi-values: append
    for (const v of vals) sp.append(key, v);
  }

  if (sortKeys) {
    const entries = Array.from(sp.entries()).sort(([a], [b]) => a.localeCompare(b, "en"));
    sp.forEach((_v, k) => sp.delete(k));
    for (const [k, v] of entries) sp.append(k, v);
  }

  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Petit helper: construit un patch "propre" (ex: "ALL" => suppression)
 */
export function cleanFilterValue<T extends string>(v: T, allValue: T = "ALL" as T): T | "" {
  return v === allValue ? ("" as any) : v;
}