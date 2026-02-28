// apps/web/src/lib/badges.ts

import type { StockTransferStatus, StockTransferPurpose } from "./stock-transfer.types";

export function transferStatusLabel(status: StockTransferStatus | string): string {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "Brouillon";
  if (s === "SHIPPED") return "Expédié";
  if (s === "PARTIALLY_RECEIVED") return "Reçu partiel";
  if (s === "RECEIVED") return "Reçu";
  if (s === "CANCELLED") return "Annulé";
  if (s === "DISPUTED") return "Litige";
  return s || "—";
}

export function transferStatusBadgeClass(status: StockTransferStatus | string): string {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100";
  if (s === "SHIPPED") return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  if (s === "PARTIALLY_RECEIVED") return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  if (s === "RECEIVED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (s === "CANCELLED") return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  if (s === "DISPUTED") return "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100";
}

export function transferPurposeLabel(purpose: StockTransferPurpose | string | null | undefined): string {
  const p = String(purpose || "").toUpperCase();
  if (!p) return "—";
  if (p === "STORE_REPLENISH") return "Réassort magasin";
  if (p === "REBALANCE") return "Rééquilibrage";
  if (p === "INTERNAL_DELIVERY") return "Livraison interne (BL)";
  if (p === "OTHER") return "Autre";
  return p;
}

export function transferPurposeBadgeClass(purpose: StockTransferPurpose | string | null | undefined): string {
  const p = String(purpose || "").toUpperCase();
  if (!p) return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100";
  if (p === "INTERNAL_DELIVERY") return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200";
  if (p === "STORE_REPLENISH") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (p === "REBALANCE") return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100";
}