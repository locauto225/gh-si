import PurchaseDetailsClient from "./purchase-details-client";

export default async function PurchaseDetailsPage({
  params,
}: {
  // pattern compatible “params should be awaited” (Next App Router)
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bon de commande</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Détail, lignes, statut, réception.
        </p>
      </div>

      <PurchaseDetailsClient id={id} />
    </div>
  );
}