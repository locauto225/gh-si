import Link from "next/link";
import { StockTransfersListClient } from "./stock-transfers-client";

type TransfersSearchParams = {
  status?: string;
  scope?: string;
  warehouseId?: string;
  q?: string;
};

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function StockTransfersPage({
  searchParams,
}: {
  searchParams?: Promise<TransfersSearchParams> | TransfersSearchParams;
}) {
  // Next 15: searchParams peut être async selon le runtime → on sécurise
  const sp = await Promise.resolve(searchParams);

  const initialStatus = asString(sp?.status) ?? "ALL";
  const initialScope = asString(sp?.scope) ?? "ALL";
  const initialWarehouseId = asString(sp?.warehouseId) ?? "ALL";
  const initialQ = asString(sp?.q) ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historique des transferts</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Consulte et filtre les transferts de stock entre entrepôts et magasins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/stock/transfers/new"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-95 dark:bg-slate-100 dark:text-slate-900"
          >
            Nouveau transfert
          </Link>
        </div>
      </div>

      <StockTransfersListClient
        initialStatus={initialStatus}
        initialScope={initialScope}
        initialWarehouseId={initialWarehouseId}
        initialQ={initialQ}
      />
    </div>
  );
}