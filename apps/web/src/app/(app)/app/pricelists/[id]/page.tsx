import PricelistDetailsClient from "./pricelist-details-client";

export default async function PricelistDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PricelistDetailsClient id={id} />;
}