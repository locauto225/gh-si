import SaleDetailsClient from "./sale-details-client";

export default async function SaleDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SaleDetailsClient id={id} />;
}