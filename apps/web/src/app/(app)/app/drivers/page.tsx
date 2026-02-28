// app/(app)/app/drivers/page.tsx
import type { Metadata } from "next";
import DriversClient from "./drivers-client";

export const metadata: Metadata = {
  title: "Livreurs — GH · SI",
};

export default function Page() {
  return <DriversClient />;
}