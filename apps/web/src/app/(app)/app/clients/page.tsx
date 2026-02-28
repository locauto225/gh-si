import ClientsClient from "./clients-client";

export default function ClientsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted">
            Gère ta base clients (contact, téléphone, plafonds, délais).
          </p>
        </div>
      </div>

      <ClientsClient />
    </div>
  );
}