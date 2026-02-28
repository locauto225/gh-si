// apps/web/src/components/ui/Card.tsx
"use client";

import type { ReactNode } from "react";

/**
 * Utilitaires simples pour composer des className sans dépendance.
 */
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Card de base (conteneur)
 */
export function Card({
  children,
  className,
  header,
  footer,
}: {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={cx("rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60", className)}>
      {header ? <div className="border-b border-border px-4 py-3">{header}</div> : null}
      <div className="p-4">{children}</div>
      {footer ? <div className="border-t border-border px-4 py-3">{footer}</div> : null}
    </div>
  );
}

/**
 * Header standard (titre + action à droite)
 */
export function CardHeader({
  title,
  right,
  subtitle,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-muted">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/**
 * Variante “Section card” : header légèrement teinté via mix card/background
 * (évite le bg-slate-50 hardcodé, suit ton thème)
 */
export function SectionCard({
  title,
  right,
  subtitle,
  children,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60", className)}>
      <div className="border-b border-border px-4 py-3 bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]">
        <CardHeader title={title} right={right} subtitle={subtitle} />
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/**
 * KPI / Stat pill (compact)
 */
export function StatPill({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-xl border border-border bg-card px-4 py-3 shadow-sm ring-1 ring-border/60", className)}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums text-foreground">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

/**
 * Empty state (dashed)
 */
export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted", className)}>
      {children}
    </div>
  );
}

/**
 * Ligne “Recent” (liste cliquable) — suit le thème
 */
export function RecentRow({
  href,
  title,
  subtitle,
  right,
  badge,
  className,
}: {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cx(
        "group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2",
        "hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium text-foreground group-hover:underline">{title}</div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {subtitle ? <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0 tabular-nums text-sm font-medium text-foreground">{right}</div> : null}
    </a>
  );
}