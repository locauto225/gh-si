// apps/web/src/lib/date.ts

export function safeParseDate(input: unknown): Date | null {
  if (!input) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function fmtDateShort(input: unknown, locale: string = "fr-FR"): string {
  const d = safeParseDate(input);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function fmtDateTime(input: unknown, locale: string = "fr-FR"): string {
  const d = safeParseDate(input);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(d);
  } catch {
    return d.toISOString();
  }
}