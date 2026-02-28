// app/(app)/app/trips/[id]/drive/page.tsx

import type { Metadata } from "next";
import DriveClient from "./drive-client";

export const metadata: Metadata = {
  title: "Vue livreur — GH · SI",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriveClient id={id} />;
}