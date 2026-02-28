import StockClient from "./stock-client";

export default function StockPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stock</h1>
          <p className="text-sm text-muted">
            Consulte les quantités par entrepôt ou magasin. Les opérations (transfert, inventaire, retours) se font via les pages dédiées.
          </p>
        </div>
      </div>

      <StockClient />
    </div>
  );
}