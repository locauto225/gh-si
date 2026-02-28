import SuppliersClient from "./suppliers-client";

export default function SuppliersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fournisseurs</h1>
          <p className="text-sm text-muted">Référentiel fournisseurs (recherche, création).</p>
        </div>
      </div>

      <SuppliersClient />
    </div>
  );
}