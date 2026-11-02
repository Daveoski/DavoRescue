"use client";

import { LocateFixed } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { IncidentMap } from "@/domains/map/components/lazy";
import { states } from "@/shared/config/site";
import { cn } from "@/shared/lib/cn";
import { timeAgo, titleCase } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { incidentsApi } from "../api";
import { categoryMeta } from "../catalogue";
import type { Category, PublicIncident } from "../types";
import { RoadBadge, SeverityBadge, StatusBadge } from "./badges";
import { IncidentIcon } from "./incident-icon";

const WINDOWS = [
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
  { hours: 72, label: "3 days" },
];

export function LiveBoard() {
  const [hours, setHours] = useState(24);
  const [state, setState] = useState<string>("");
  const [category, setCategory] = useState<Category | "">("");
  const [incidents, setIncidents] = useState<PublicIncident[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  usePoll(
    async () => {
      try {
        setIncidents(await incidentsApi.live({ hours, state: state || undefined }));
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    20_000,
    `${hours}:${state}`,
  );

  const shown = useMemo(
    () => (incidents ?? []).filter((i) => !category || i.category === category),
    [incidents, category],
  );
  const center = states.find((s) => s.slug === state) ?? states[0];
  const focus = shown.find((i) => i.ref === selected) ?? me;

  function nearMe() {
    navigator.geolocation?.getCurrentPosition((p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }));
  }

  return (
    <div className="grid lg:h-[calc(100dvh-6.5rem)] lg:grid-cols-[420px_minmax(0,1fr)]">
      <aside className="order-2 flex min-h-0 flex-col border-base-300 lg:order-1 lg:border-r">
        <div className="space-y-3 border-b border-base-300 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold">Live incidents</h1>
            <span className="flex items-center gap-1.5 text-xs text-base-content/60">
              <span className="relative flex size-2">
                <span className="pulse-ring absolute inline-flex size-full rounded-full bg-success" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Live
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="select select-sm w-auto" value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
              <option value="">All South-East</option>
              {states.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="select select-sm w-auto"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "")}
              aria-label="Type"
            >
              <option value="">All types</option>
              {Object.entries(categoryMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
            <div className="join">
              {WINDOWS.map((w) => (
                <button
                  key={w.hours}
                  type="button"
                  className={cn("btn btn-sm join-item", hours === w.hours && "btn-secondary")}
                  onClick={() => setHours(w.hours)}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-sm gap-1" onClick={nearMe}>
              <LocateFixed className="size-4" /> Near me
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {failed && !incidents ? (
            <p className="p-6 text-sm">Couldn&apos;t load incidents. Check your connection — we&apos;ll keep retrying.</p>
          ) : !incidents ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="p-6">
              <p className="font-semibold">No verified incidents in this window.</p>
              <p className="mt-1 text-sm text-base-content/65">
                Seeing something? <Link href="/report" className="link link-primary">Report it</Link>.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-base-300">
              {shown.map((i) => {
                return (
                  <li key={i.ref}>
                    <button
                      type="button"
                      onClick={() => setSelected(i.ref)}
                      className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-base-200", selected === i.ref && "bg-base-200")}
                    >
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-full text-white"
                        style={{ background: categoryMeta[i.category].color }}
                      >
                        <IncidentIcon category={i.category} subtype={i.subtype} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{titleCase(i.subtype)}</span>
                          <SeverityBadge severity={i.severity} />
                        </span>
                        <span className="block truncate text-sm text-base-content/65">
                          {i.road_name ?? i.lga ?? "Pinned location"} · {timeAgo(i.created_at)}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusBadge status={i.status} />
                          <RoadBadge navigability={i.navigability} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="order-1 h-[55dvh] lg:order-2 lg:h-auto">
        <IncidentMap
          incidents={shown}
          center={[center.lat, center.lng]}
          zoom={state ? 11 : 9}
          focus={focus}
          me={me}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}
