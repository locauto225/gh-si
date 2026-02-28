// apps/web/src/app/(app)/app/stock/transfers/[id]/page.tsx
import Link from "next/link";
import { TransferDetailsClient } from "./transfer-details-client";

export default async function TransferDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Détail du transfert
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Suivi expédition / réception et lignes.
          </p>
        </div>

        <Link
          href="/app/stock/transfers"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          ← Retour
        </Link>
      </div>

      <TransferDetailsClient id={id} />
    </div>
  );
}