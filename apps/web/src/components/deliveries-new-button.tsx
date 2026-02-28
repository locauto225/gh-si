// Fragment à intégrer dans deliveries-client.tsx
// Remplace le bouton "Nouveau BL" existant par ce dropdown

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, Package, Store } from "lucide-react";

export function NewBLButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Ferme le menu si on clique ailleurs
  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative" onBlur={onBlur}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Nouveau BL
        <ChevronDown className={["h-3.5 w-3.5 transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg ring-1 ring-border/60">
          <button
            type="button"
            tabIndex={0}
            onClick={() => { setOpen(false); router.push("/app/deliveries/new?mode=sale"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            <Package className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="font-medium text-foreground">Depuis une vente</div>
              <div className="text-xs text-muted">Livraison client</div>
            </div>
          </button>

          <div className="border-t border-border" />

          <button
            type="button"
            tabIndex={0}
            onClick={() => { setOpen(false); router.push("/app/deliveries/new?mode=internal"); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[color-mix(in_oklab,var(--card),var(--background)_35%)]"
          >
            <Store className="h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <div className="font-medium text-foreground">Réassort magasin</div>
              <div className="text-xs text-muted">Mouvement interne</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}