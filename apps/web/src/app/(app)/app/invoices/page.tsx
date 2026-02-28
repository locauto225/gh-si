import InvoicesClient from "./invoices-client";

export default function InvoicesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Factures</h1>
          <p className="text-sm text-muted">Suivi des factures et statut d’envoi FNE.</p>
        </div>
      </div>

      <InvoicesClient />
    </div>
  );
}