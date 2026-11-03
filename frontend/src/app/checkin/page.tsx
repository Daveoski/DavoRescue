import type { Metadata } from "next";

import { CheckInPanel } from "@/domains/roadpulse/components/check-in-panel";

export const metadata: Metadata = {
  title: "Road check-in — tell drivers behind you",
  description:
    "One tap to tell other drivers on Enugu's roads that the way is clear, that vehicles are turning back, or that you've seen a warning sign.",
  alternates: { canonical: "/checkin" },
};

export default function CheckInPage() {
  return (
    <div className="wrap max-w-xl py-8 sm:py-12">
      <header className="mb-6">
        <p className="eyebrow">Road check-in · no account needed</p>
        <h1 className="mt-2 text-4xl font-extrabold">How’s the road?</h1>
        <p className="mt-2 text-base-content/70">One tap tells the drivers behind you. Only check in when you’ve stopped safely.</p>
      </header>
      <CheckInPanel />
    </div>
  );
}
