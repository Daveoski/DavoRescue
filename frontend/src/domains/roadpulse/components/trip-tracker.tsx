"use client";

import { Navigation, Phone } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { clockTime, timeAgo } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { tripsApi } from "../api";
import type { SharedTrip } from "../types";
import { tripStateMeta } from "./trip-state";

const TripMap = dynamic(() => import("./trip-map"), {
  ssr: false,
  loading: () => <div className="grid-paper h-full w-full bg-base-200" />,
});

/** What a contact sees when they open the traveller's link. */
export function TripTracker({ token }: { token: string }) {
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePoll(async () => {
    try {
      setTrip(await tripsApi.shared(token));
      setError(null);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }, 30_000);

  if (error && !trip) return <p className="rounded-box bg-base-200 p-6">{error}</p>;
  if (!trip) return <div className="skeleton h-80 w-full" />;

  const meta = tripStateMeta[trip.state];
  const pos = trip.last_position;

  return (
    <div className="space-y-6">
      <section className={cn("rounded-box p-5", meta.panel)}>
        <p className="eyebrow !text-current opacity-75">{meta.label}</p>
        <h1 className="mt-1 text-3xl font-extrabold">
          {trip.traveller} → {trip.destination}
        </h1>
        <p className="mt-2">
          Started {clockTime(trip.started_at)} · expected by <strong className="font-mono">{clockTime(trip.eta)}</strong>
          {trip.ended_at && ` · ended ${clockTime(trip.ended_at)}`}
        </p>
        {trip.state === "overdue" && (
          <p className="mt-3 font-medium">
            {trip.traveller} hasn’t checked in. Try calling them. If you can’t reach them and you’re worried, call 112 and share
            their last position below.
          </p>
        )}
      </section>

      {trip.state === "overdue" && (
        <a href="tel:112" className="btn btn-error btn-lg w-full gap-2 font-mono">
          <Phone className="size-5" /> Call 112
        </a>
      )}

      {pos ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Last position</h2>
            <span className="text-sm text-base-content/60">{trip.last_seen_at ? `sent ${timeAgo(trip.last_seen_at)}` : ""}</span>
          </div>
          <div className="h-80 overflow-hidden rounded-box border border-base-300">
            <TripMap position={pos} />
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${pos.lat},${pos.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm gap-1.5"
          >
            <Navigation className="size-4" /> Open in Google Maps
          </a>
        </section>
      ) : (
        <p className="rounded-box bg-base-200 p-4 text-sm">{trip.traveller}’s phone hasn’t shared a position yet.</p>
      )}

      <p className="text-xs text-base-content/55">This page updates every 30 seconds while it’s open.</p>
    </div>
  );
}
