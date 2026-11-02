import type { Metadata } from "next";

import { AlertsDashboard } from "@/domains/alerts/components/alerts-dashboard";
import { RequireAuth } from "@/domains/auth/components/require-auth";
import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "Alerts near me",
  robots: { index: false },
};

export default function AlertsPage() {
  return (
    <div className="wrap space-y-8 py-10">
      <PageIntro eyebrow="Your alerts" title="What's happening around you">
        Verified incidents within your alert radius, as they&apos;re reported.
      </PageIntro>
      <RequireAuth next="/alerts">
        <AlertsDashboard />
      </RequireAuth>
    </div>
  );
}
