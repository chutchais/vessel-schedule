import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBerthPlanner } from "@/components/berth-planner/public-berth-planner";
import { sharingEnabled } from "@/lib/berth-planner/public-sharing";

export const metadata: Metadata = {
  title: "Shared Berth Planner",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function SharedBerthPlannerPage({ params }: { params: Promise<{ publicId: string }> }) {
  if (!sharingEnabled()) notFound();
  const { publicId } = await params;
  return <PublicBerthPlanner publicId={publicId} />;
}
