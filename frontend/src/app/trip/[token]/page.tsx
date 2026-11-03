import type { Metadata } from "next";
import { Suspense } from "react";

import { TripTracker } from "@/domains/roadpulse/components/trip-tracker";

export const metadata: Metadata = {
  title: "Following a trip",
  // Private links: never index them.
  robots: { index: false, follow: false },
};

export default function SharedTripPage({ params }: PageProps<"/trip/[token]">) {
  return (
    <div className="wrap max-w-2xl py-8 sm:py-12">
      <Suspense fallback={<div className="skeleton h-80 w-full" />}>
        {params.then(({ token }) => (
          <TripTracker token={token} />
        ))}
      </Suspense>
    </div>
  );
}
