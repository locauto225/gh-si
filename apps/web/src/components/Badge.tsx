// apps/web/src/components/Badge.tsx
"use client";

import * as React from "react";

type BadgeTone =
  | "slate"
  | "amber"
  | "blue"
  | "emerald"
  | "red"
  | "fuchsia"
  | "indigo"
  | "orange";

const TONE_CLASS: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
};

function cx(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(" ");
}

export function Badge({
  children,
  tone = "slate",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}