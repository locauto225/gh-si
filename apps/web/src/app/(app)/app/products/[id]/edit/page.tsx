import Link from "next/link";
import EditProductClient from "./edit-product-client";

export default function EditProductPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div className="flex-1">
          <div className="space-y-2">
            <Link
              href="/app/products"
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors tracking-widest uppercase"
            >
              ← Retour aux produits
            </Link>

            <div>
              <h1 className="text-xl font-semibold text-foreground">Modifier produit</h1>
            </div>
          </div>
        </div>
      </div>

      <EditProductClient />
    </div>
  );
}
