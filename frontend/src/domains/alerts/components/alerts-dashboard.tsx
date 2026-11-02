"use client";

import { Bell, BellOff, LocateFixed, Navigation } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { authApi } from "@/domains/auth/api";
import { useAuth } from "@/domains/auth/store";
import { RoadBadge, SeverityBadge, StatusBadge } from "@/domains/incidents/components/badges";
import { IncidentIcon } from "@/domains/incidents/components/incident-icon";
import type { PublicIncident } from "@/domains/incidents/types";
import { IncidentMap } from "@/domains/map/components/lazy";
import { cn } from "@/shared/lib/cn";
import { distance, timeAgo, titleCase } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { alertsApi, type Feed } from "../api";
import { disablePush, enablePush, pushState, type PushState } from "../push";

const RADII = [5, 10, 15, 25, 50];
const POLL_MS = 20_000;

const pushCopy: Record<PushState, string> = {
  enabled: "Push alerts are on for this device.",
  disabled: "Get a notification the moment a verified incident is reported near you — even with the app closed.",
  denied: "Notifications are blocked for this site. Allow them in your browser settings to get alerts.",
  unsupported:
    "This browser can't receive push alerts. Keep this page open (or use the Android app) and we'll alert you here.",
  unavailable: "Push alerts aren't configured on the server yet. This page still updates live while open.",
};

export function AlertsDashboard() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [push, setPush] = useState<PushState>("disabled");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await alertsApi.feed();
      // Anything new since the last poll gets a buzz and, if the tab is hidden, a notification.
      if (seen.current) {
        const fresh = next.items.filter((i) => !seen.current!.has(i.ref));
        if (fresh.length) {
          navigator.vibrate?.([180, 80, 180]);
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            const top = fresh[0];
            new Notification(`${titleCase(top.subtype)} · ${top.road_name ?? top.lga ?? "near you"}`, {
              body: top.alert ?? "Verified emergency near you",
              tag: top.ref,
            });
          }
        }
      }
      seen.current = new Set(next.items.map((i) => i.ref));
      setFeed(next);
    } catch {
      /* transient — next poll will retry */
    }
  }, []);

  usePoll(refresh, POLL_MS);

  useEffect(() => {
    pushState().then(setPush);
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) return setMessage("This device can't share its location.");
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setUser(await authApi.update({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
          setMessage(null);
          await refresh();
        } finally {
          setBusy(null);
        }
      },
      () => {
        setBusy(null);
        setMessage("We couldn't get your location. Allow location access to receive nearby alerts.");
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    );
  }, [refresh, setUser]);

  // Refresh the saved position on every visit so alerts follow the user around.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => p.state === "granted" && locate())
      .catch(() => undefined);
  }, [locate]);

  async function togglePush() {
    setBusy("push");
    try {
      setPush(push === "enabled" ? await disablePush() : await enablePush());
    } catch {
      setMessage("Couldn't change push alerts. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function setRadius(km: number) {
    setUser(await authApi.update({ alert_radius_km: km }));
    refresh();
  }

  if (!user) return null;
  const items = feed?.items ?? [];
  const here = user.last_lat !== null && user.last_lng !== null ? { lat: user.last_lat, lng: user.last_lng } : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <section className="rounded-box border border-base-300 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Alert area</p>
              <p className="mt-1 text-lg font-bold">
                {here ? `Within ${user.alert_radius_km} km of your last location` : "Set your location to get alerts"}
              </p>
            </div>
            <button type="button" className="btn btn-sm gap-1.5" onClick={locate} disabled={busy === "locate"}>
              {busy === "locate" ? <span className="loading loading-spinner loading-xs" /> : <LocateFixed className="size-4" />}
              Update
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Alert radius">
            {RADII.map((km) => (
              <button
                key={km}
                type="button"
                role="radio"
                aria-checked={user.alert_radius_km === km}
                className={cn("btn btn-sm rounded-full font-mono", user.alert_radius_km === km ? "btn-secondary" : "btn-ghost border-base-300")}
                onClick={() => setRadius(km)}
              >
                {km} km
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-box border border-base-300 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Push alerts</p>
              <p className="mt-1 text-sm text-base-content/75">{pushCopy[push]}</p>
            </div>
            {(push === "enabled" || push === "disabled") && (
              <button type="button" className={cn("btn btn-sm gap-1.5", push === "disabled" && "btn-primary")} onClick={togglePush} disabled={busy === "push"}>
                {push === "enabled" ? <BellOff className="size-4" /> : <Bell className="size-4" />}
                {push === "enabled" ? "Turn off" : "Turn on"}
              </button>
            )}
          </div>
        </section>

        {message && <p className="rounded-box bg-warning/10 p-3 text-sm">{message}</p>}

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Near you, last 24 hours</h2>
            <span className="text-xs text-base-content/55">Live · updates every 20 s</span>
          </div>
          {!feed ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
            </div>
          ) : !feed.located ? (
            <p className="rounded-box bg-base-200 p-5 text-sm">Tap “Update” above to share your location and see incidents around you.</p>
          ) : items.length === 0 ? (
            <p className="rounded-box bg-base-200 p-5 text-sm">
              Nothing verified within {feed.radius_km} km in the last 24 hours. We&apos;ll alert you if that changes.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <AlertItem key={i.ref} incident={i} active={selected === i.ref} onFocus={() => setSelected(i.ref)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="h-[420px] overflow-hidden rounded-box border border-base-300 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]">
        <IncidentMap
          incidents={items}
          center={here ? [here.lat, here.lng] : [6.4584, 7.5464]}
          zoom={here ? 12 : 10}
          me={here}
          selected={selected}
          focus={items.find((i) => i.ref === selected) ?? null}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}

function AlertItem({ incident, active, onFocus }: { incident: PublicIncident; active: boolean; onFocus: () => void }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${incident.lat},${incident.lng}`;
  return (
    <li
      className={cn(
        "rounded-box border bg-base-100 p-4 transition-colors",
        active ? "border-primary" : "border-base-300",
      )}
    >
      <button type="button" onClick={onFocus} className="flex w-full items-start gap-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <IncidentIcon category={incident.category} subtype={incident.subtype} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{titleCase(incident.subtype)}</span>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </span>
          <span className="mt-0.5 block text-sm text-base-content/70">
            {incident.road_name ?? incident.lga ?? "Pinned location"}
            {incident.distance_m !== undefined && ` · ${distance(incident.distance_m)} away`} · {timeAgo(incident.created_at)}
          </span>
          {incident.alert && <span className="mt-2 block text-sm">{incident.alert}</span>}
        </span>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-13">
        <RoadBadge navigability={incident.navigability} />
        <Link href={`/incidents/${incident.ref}`} className="btn btn-xs btn-ghost">
          Details
        </Link>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-ghost gap-1">
          <Navigation className="size-3" /> Open in Maps
        </a>
      </div>
    </li>
  );
}
