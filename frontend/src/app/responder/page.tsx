import type { Metadata } from "next";

import { RequireAuth } from "@/domains/auth/components/require-auth";
import { ResponderConsole } from "@/domains/responder/components/responder-console";

export const metadata: Metadata = {
  title: "Responder console",
  robots: { index: false, follow: false },
};

export default function ResponderPage() {
  return (
    <div className="wrap max-w-7xl py-8">
      <header className="mb-6">
        <p className="eyebrow">Responders</p>
        <h1 className="mt-2 text-3xl font-extrabold">Incident console</h1>
      </header>
      <RequireAuth responder next="/responder">
        <ResponderConsole />
      </RequireAuth>
    </div>
  );
}
