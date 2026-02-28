import FiscalClient from "./fiscal-client";

export default function FiscalPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fiscal</h1>
          <p className="text-sm text-muted">
            Suivi FNE : état d’envoi, événements et erreurs (mode “simulateur” tant que l’API DGI n’est pas branchée).
          </p>
        </div>
      </div>

      <FiscalClient />
    </div>
  );
}