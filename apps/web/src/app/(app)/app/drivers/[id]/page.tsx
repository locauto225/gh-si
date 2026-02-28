// app/(app)/app/drivers/[id]/page.tsx
import type { Metadata } from "next";
import DriverDetailsClient from "./driver-details-client";

export const metadata: Metadata = {
  title: "Fiche livreur — GH · SI",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverDetailsClient id={id} />;
}