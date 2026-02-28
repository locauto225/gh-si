import InvoiceDetailsClient from "./invoice-details-client";

export default async function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Facture</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Lecture et actions (statut, envoi FNE).
        </p>
      </div>

      <InvoiceDetailsClient id={id} />
    </div>
  );
}