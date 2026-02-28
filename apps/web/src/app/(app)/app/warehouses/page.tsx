import WarehousesClient from "./warehouses-client";

export default function WarehousesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Entrepôts</h1>
          <p className="text-sm text-muted">Crée et gère tes entrepôts (code, nom, adresse).</p>
        </div>
      </div>

      <WarehousesClient />
    </div>
  );
}