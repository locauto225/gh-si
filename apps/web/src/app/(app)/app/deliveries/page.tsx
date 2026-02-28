import DeliveriesClient from "./deliveries-client";

export default function DeliveriesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bons de livraison</h1>
          <p className="text-sm text-muted">Suivi, affectation aux tournées.</p>
        </div>
      </div>

      <DeliveriesClient />
    </div>
  );
}