import type { Metadata } from "next";
import { Suspense } from "react";

import { IncidentDetail } from "@/domains/incidents/components/incident-detail";

export async function generateMetadata({ params }: PageProps<"/incidents/[ref]">): Promise<Metadata> {
  const { ref } = await params;
  return {
    title: `Incident ${ref.toUpperCase()}`,
    // Incidents are time-sensitive and location-specific; keep them out of search results.
    robots: { index: false, follow: true },
  };
}

export default function IncidentPage({ params }: PageProps<"/incidents/[ref]">) {
  return (
    <div className="wrap max-w-7xl py-10">
      <Suspense fallback={<div className="skeleton h-[60dvh] w-full" />}>
        {params.then(({ ref }) => (
          <IncidentDetail incidentRef={ref.toUpperCase()} />
        ))}
      </Suspense>
    </div>
  );
}
