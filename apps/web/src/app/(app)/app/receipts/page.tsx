import ReceiptsClient from "./receipts-client";

export default function ReceiptsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Réceptions</h1>
          <p className="text-sm text-muted">
            Historique des bons de commande réceptionnés (filtres date, fournisseur, entrepôt).
          </p>
        </div>
      </div>

      <ReceiptsClient />
    </div>
  );
}