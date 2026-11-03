import type { Metadata } from "next";

import { RequireAuth } from "@/domains/auth/components/require-auth";
import { TripGuardian } from "@/domains/roadpulse/components/trip-guardian";

export const metadata: Metadata = {
  title: "Trip guardian",
  description:
    "Tell DavoRescue where you're going. The people you choose get a text and an email with a link to follow your live location, and an alert if you don't arrive.",
  alternates: { canonical: "/trip" },
};

export default function TripPage() {
  return (
    <div className="wrap max-w-xl py-8 sm:py-12">
      <header className="mb-6">
        <p className="eyebrow">Trip guardian</p>
        <h1 className="mt-2 text-4xl font-extrabold">Someone’s watching your back</h1>
        <p className="mt-2 text-base-content/70">
          Tell the people you choose where you’re going. They get a text and an email with a link to follow your live location, and
          an alert if you haven’t checked in 15 minutes after your arrival time.
        </p>
      </header>
      <RequireAuth next="/trip" redirect>
        <TripGuardian />
      </RequireAuth>
    </div>
  );
}
