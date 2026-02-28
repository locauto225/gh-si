import DeliveryDetailsClient from "./delivery-details-client";

export default async function DeliveryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeliveryDetailsClient id={id} />;
}