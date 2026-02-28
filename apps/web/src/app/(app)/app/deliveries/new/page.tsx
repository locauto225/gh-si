import { redirect } from "next/navigation";
import NewDeliveryClient from "./new-delivery-client";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; saleId?: string; orderId?: string }>;
}) {
  const { mode: rawMode, saleId, orderId } = await searchParams;

  const mode = (rawMode ?? "sale").toLowerCase();

  // Si mode invalide → redirige vers le mode vente par défaut
  if (mode !== "sale" && mode !== "order" && mode !== "internal") {
    redirect("/app/deliveries/new?mode=sale");
  }

  return (
    <NewDeliveryClient
      mode={mode as "sale" | "order" | "internal"}
      saleId={saleId?.trim() || undefined}
      orderId={orderId?.trim() || undefined}
    />
  );
}