"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { withNext } from "@/domains/auth/next-path";
import { useAuth, useSessionReady } from "@/domains/auth/store";

/** Signed-out visitors sign in first, then land straight on the trip form. */
export function TripGuardianCta() {
  const ready = useSessionReady();
  const signedIn = useAuth((s) => s.user !== null);
  const canStart = ready && signedIn;

  return (
    <div>
      <Link href={canStart ? "/trip" : withNext("/signin", "/trip")} className="btn btn-primary btn-lg">
        Start a trip <ArrowRight className="size-5" />
      </Link>
      <p className="mt-3 min-h-5 text-sm text-base-content/60">
        {ready && !signedIn && "Free account needed, so your contacts know who’s travelling."}
      </p>
    </div>
  );
}
