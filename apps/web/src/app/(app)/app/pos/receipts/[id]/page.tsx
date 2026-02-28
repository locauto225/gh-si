import ReceiptDetailsClient from "./receipt-details-client";

export const dynamic = "force-dynamic";

export default async function PosReceiptDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceiptDetailsClient id={id} />;
}