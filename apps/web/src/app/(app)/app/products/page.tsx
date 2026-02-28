import ProductsClient from "./products-client";

export default function ProductsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1.5 h-5 w-1.5 rounded-full bg-[var(--primary)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Produits</h1>
          <p className="text-sm text-muted">Catalogue produits : SKU, unité, prix et statut.</p>
        </div>
      </div>

      <ProductsClient />
    </div>
  );
}