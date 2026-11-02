import type { Metadata } from "next";

import { LiveBoard } from "@/domains/incidents/components/live-board";

export const metadata: Metadata = {
  title: "Live incident map — Enugu & South-East roads",
  description:
    "Verified robberies, kidnappings, shootings, fires, crashes and medical emergencies on roads in Enugu, Anambra, Abia, Ebonyi and Imo, updated live.",
  alternates: { canonical: "/live" },
};

export default function LivePage() {
  return <LiveBoard />;
}
