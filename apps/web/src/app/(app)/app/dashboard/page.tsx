// apps/web/src/app/(app)/app/dashboard/page.tsx
import DashboardClient from "./dashboard-client";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]"
        />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted">
            Vue rapide des ventes, factures, livraisons et achats.
          </p>
        </div>
      </div>

      <DashboardClient />
    </div>
  );
}