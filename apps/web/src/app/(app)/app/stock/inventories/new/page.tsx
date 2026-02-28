import Link from "next/link";
import NewInventoryClient from "./new-inventory-client";

export const metadata = {
  title: "Nouvel inventaire — Stock",
};

export default function NewStockInventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Nouvel inventaire
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Crée un document d’inventaire en brouillon (DRAFT). Les lignes seront générées ensuite.
          </p>
        </div>

        <Link
          href="/app/stock/inventories"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          Retour
        </Link>
      </div>

      <NewInventoryClient />
    </div>
  );
}