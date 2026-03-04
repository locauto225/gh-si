import Link from "next/link";
import { Truck } from "lucide-react";
import { StockTransfersNewClient } from "../stock-transfers-client";

export default function StockTransfersNewPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Créer un transfert de stock
          </h1>
          <p className="mt-1 text-sm text-muted">
            Enregistre un mouvement entre deux entrepôts ou magasins. La destination
            confirme ce qu'elle a reçu — la réception partielle est possible.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/stock/transfers"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-[color-mix(in_oklab,var(--card),var(--background)_30%)] transition-colors"
          >
            Retour à la liste
          </Link>
        </div>
      </div>

      {/* Bannière d'information — distingue transfert de stock vs BL chauffeur */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Un transfert seul ne génère pas de bon de livraison.</span>
          {" "}Si un chauffeur transporte la marchandise et doit repartir avec un document,
          créez d&apos;abord un{" "}
          <Link
            href="/app/deliveries/new?mode=internal"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            bon de livraison réassort
          </Link>
          {" "}depuis la section Logistique, puis enregistrez ce transfert pour la traçabilité stock.
        </div>
      </div>

      {/* Création d'un transfert (workflow unique côté backend) */}
      <StockTransfersNewClient />
    </div>
  );
}