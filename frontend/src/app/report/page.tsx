import type { Metadata } from "next";
import Link from "next/link";

import { ReportForm } from "@/domains/report/components/report-form";

export const metadata: Metadata = {
  title: "Report an emergency",
  description:
    "Report a robbery, kidnapping, shooting, explosion, fire, crash or medical emergency in Enugu and the South-East. No account needed — your exact location is sent to responders.",
  alternates: { canonical: "/report" },
};

export default function ReportPage() {
  return (
    <div className="wrap max-w-3xl py-8 sm:py-12">
      <header className="mb-8">
        <p className="eyebrow">Anonymous · takes under a minute</p>
        <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Report an emergency</h1>
        <p className="mt-3 text-sm text-base-content/70">
          Nothing has happened yet, but something looks wrong on the road?{" "}
          <Link href="/checkin" className="link link-primary font-medium">
            Send a warning sign instead
          </Link>
          .
        </p>
      </header>
      <ReportForm />
    </div>
  );
}
