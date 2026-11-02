"use client";

import { MessageSquare, Navigation } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CallList } from "@/domains/agencies/components/call-list";
import { agenciesForState, primaryLine } from "@/domains/agencies/data";
import { IncidentMap } from "@/domains/map/components/lazy";
import { site } from "@/shared/config/site";
import { ApiError } from "@/shared/lib/api-client";
import { clockTime, coords, timeAgo, titleCase } from "@/shared/lib/format";

import { incidentsApi } from "../api";
import { categoryMeta } from "../catalogue";
import type { PublicIncident } from "../types";
import { RoadBadge, SeverityBadge, StatusBadge } from "./badges";

export function IncidentDetail({ incidentRef }: { incidentRef: string }) {
  const [incident, setIncident] = useState<PublicIncident | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      incidentsApi
        .get(incidentRef)
        .then(setIncident)
        .catch((e: ApiError) => setError(e.status === 404 ? "not-found" : e.message));
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [incidentRef]);

  if (error === "not-found") {
    return (
      <div className="max-w-lg">
        <h1 className="text-3xl font-extrabold">No public incident {incidentRef}</h1>
        <p className="mt-3 text-base-content/70">
          It may still be under review, or it was not verified. Reports that aren&apos;t verified are never shown publicly.
        </p>
        <Link href="/live" className="btn mt-6">
          Open the live map
        </Link>
      </div>
    );
  }
  if (error) return <p className="rounded-box bg-error/10 p-4 text-error">{error}</p>;
  if (!incident) return <div className="skeleton h-[60dvh] w-full" />;

  const i = incident;
  const lines = agenciesForState(i.state)
    .slice(0, 4)
    .map((a) => ({ name: a.short_name, kind: a.kind, phones: [primaryLine(a)] }));
  const share = encodeURIComponent(`${titleCase(i.subtype)} near ${i.road_name ?? i.lga ?? "this location"}. ${i.alert ?? ""}\n${site.url}/incidents/${i.ref}`);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <div>
          <p className="eyebrow">
            {categoryMeta[i.category].label} · {i.ref} · {clockTime(i.created_at)} WAT ({timeAgo(i.created_at)})
          </p>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{titleCase(i.subtype)}</h1>
          <p className="mt-2 text-lg text-base-content/75">
            {i.road_name ?? "Off-road location"}
            {i.lga && `, ${i.lga}`} · {titleCase(i.state)} State
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SeverityBadge severity={i.severity} />
            <StatusBadge status={i.status} />
            <RoadBadge navigability={i.navigability} />
          </div>
        </div>

        {i.alert && <p className="rounded-box border-l-4 border-accent bg-base-200 p-4 text-lg">{i.alert}</p>}

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="eyebrow">Coordinates</dt>
            <dd className="mt-1 font-mono tabular">{coords(i.lat, i.lng)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Corroborating reports</dt>
            <dd className="mt-1">{i.corroboration_count || "None yet"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="eyebrow">Responders alerted</dt>
            <dd className="mt-1">{i.agencies_notified.length ? i.agencies_notified.join(", ") : "Logged for the responder console"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${i.lat},${i.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn gap-2"
          >
            <Navigation className="size-4" /> Open in Google Maps
          </a>
          <a href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener noreferrer" className="btn gap-2">
            <MessageSquare className="size-4" /> Warn your contacts
          </a>
        </div>

        <CallList entries={lines} title={`Emergency lines for ${titleCase(i.state)}`} />
      </div>

      <div className="h-[420px] overflow-hidden rounded-box border border-base-300 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
        <IncidentMap incidents={[i]} center={[i.lat, i.lng]} zoom={15} selected={i.ref} />
      </div>
    </div>
  );
}
