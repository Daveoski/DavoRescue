import type { Metadata } from "next";

import { RequireAuth } from "@/domains/auth/components/require-auth";
import { TripGuardian } from "@/domains/roadpulse/components/trip-guardian";

export const metadata: Metadata = {
  title: "Trip guardian",
  description: "Tell DavoRescue where you're going and when you'll arrive. If you don't check in, the people you choose are alerted.",
  alternates: { canonical: "/trip" },
};

export default function TripPage() {
  return (
    <div className="wrap max-w-xl py-8 sm:py-12">
      <header className="mb-6">
        <p className="eyebrow">Trip guardian</p>
        <h1 className="mt-2 text-4xl font-extrabold">Someone’s watching your back</h1>
        <p className="mt-2 text-base-content/70">
          Set your destination and arrival time. If you haven’t checked in 15 minutes after it, the people you choose get your last
          location.
        </p>
      </header>
      <RequireAuth next="/trip">
        <TripGuardian />
      </RequireAuth>
    </div>
  );
}
