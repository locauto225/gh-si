import Link from "next/link";
import InventoriesListClient from "./inventories-list-client";

export const metadata = {
  title: "Inventaires — Stock",
};

export default function StockInventoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventaires</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Crée un inventaire (document), génère les lignes automatiquement, compte puis clôture.
          </p>
        </div>

        <Link
          href="/app/stock/inventories/new"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Nouvel inventaire
        </Link>
      </div>

      <InventoriesListClient />
    </div>
  );
}