import Link from "next/link";
import { StockTransfersNewClient } from "../stock-transfers-client";

export default function StockTransfersNewPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Créer un transfert
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Prépare un envoi, puis la destination confirme ce qu’elle a reçu (réception possible
            partielle). Le système gère le suivi automatiquement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/stock/transfers"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          >
            Retour à la liste
          </Link>
        </div>
      </div>

      {/* Création d’un transfert (workflow unique côté backend) */}
      <StockTransfersNewClient />
    </div>
  );
}