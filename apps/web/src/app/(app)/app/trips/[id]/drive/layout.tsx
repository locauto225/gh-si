// app/(app)/app/trips/[id]/drive/layout.tsx

import type { ReactNode } from "react";

// Court-circuite le layout parent (sidebar) — plein écran pour le livreur
export default function DriveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {children}
    </div>
  );
}