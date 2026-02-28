import ReceiptsClient from "./receipts-client";

export const dynamic = "force-dynamic";

export default async function PosReceiptsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const storeId = typeof sp.storeId === "string" ? sp.storeId : undefined;

  return <ReceiptsClient storeId={storeId} />;
}