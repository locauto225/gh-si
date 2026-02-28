import WarehouseDetailsClient from "./warehouse-details-client";

export default async function WarehouseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WarehouseDetailsClient id={id} />;
}