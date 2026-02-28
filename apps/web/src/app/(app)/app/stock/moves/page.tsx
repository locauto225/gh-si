import StockMovesClient from "./stock-moves-client";

export default function StockMovesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mouvements de stock</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Enregistre une entrée/sortie/ajustement et consulte l’historique.
        </p>
      </div>

      <StockMovesClient />
    </div>
  );
}