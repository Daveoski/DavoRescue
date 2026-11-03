import type { Metadata } from "next";

import { RoadWatchBoard } from "@/domains/roadwatch/components/road-watch-board";

export const metadata: Metadata = {
  title: "Road Watch — how safe are Enugu’s major roads?",
  description:
    "Stretch-by-stretch safety ratings for the Enugu–Onitsha and Enugu–Port Harcourt expressways, the Nsukka, Opi, Abakaliki, Agbani and Adani roads, from verified incident reports and AI review of satellite imagery.",
  alternates: { canonical: "/roads" },
};

export default function RoadsPage() {
  return <RoadWatchBoard />;
}
