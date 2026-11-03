"use client";

import { Navigation } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { responderSignalsApi } from "@/domains/roadpulse/api";
import { signLabel, statusMeta } from "@/domains/roadpulse/catalogue";
import type { WarningCluster } from "@/domains/roadpulse/types";
import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { clockTime, timeAgo } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

export function ResponderWarnings() {
  const [clusters, setClusters] = useState<WarningCluster[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => setClusters(await responderSignalsApi.list(24).catch(() => []));
  usePoll(load, 15_000);

  async function act(id: string, action: "confirm" | "dismiss" | "escalate") {
    setBusy(`${id}:${action}`);
    try {
      const r = await responderSignalsApi.review(id, action);
      setNotice(
        r.incident_ref
          ? `Escalated as incident ${r.incident_ref} and dispatched.`
          : action === "dismiss"
            ? "Warning dismissed."
            : `Warning confirmed${r.people_alerted ? ` — ${r.people_alerted} people nearby alerted` : ""}.`,
      );
      await load();
    } catch (err) {
      setNotice((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  if (!clusters) return <div className="skeleton h-48 w-full" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-base-content/70">
        Early warning signs from drivers in the last 24 hours, including unverified ones the public can’t see. Confirming shows a
        warning on Road Watch and alerts people nearby; escalating also creates an incident and pages the agencies.
      </p>
      {notice && <p className="rounded-box bg-base-200 p-3 text-sm">{notice}</p>}
      {clusters.length === 0 ? (
        <p className="rounded-box bg-base-200 p-6 text-sm">No warning signs reported in the last 24 hours.</p>
      ) : (
        <ul className="space-y-3">
          {clusters.map((c) => (
            <li key={c.id} className={cn("rounded-box border p-4", c.status === "dismissed" ? "border-base-300 opacity-60" : "border-warning/40")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.signs.map((s) => signLabel[s] ?? s).join(" · ")}</p>
                  <p className="text-sm text-base-content/65">
                    {c.segment ? `${c.segment.corridor_name}, ${c.segment.label}` : `${c.lat}, ${c.lng}`} · first {clockTime(c.first_seen)}, last{" "}
                    {timeAgo(c.last_seen)}
                  </p>
                </div>
                <span className={cn("badge", statusMeta[c.status].badge)}>
                  {statusMeta[c.status].label} · {c.sources} source{c.sources > 1 ? "s" : ""}
                </span>
              </div>

              <ul className="mt-3 space-y-1 border-l border-base-300 pl-3 text-sm">
                {c.reports?.map((r, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-base-content/55">{clockTime(r.created_at)}</span>{" "}
                    {signLabel[r.sign ?? r.kind] ?? r.kind} — <span className="text-base-content/70">{r.reporter}</span>
                    {r.note && <span className="block text-base-content/80">“{r.note}”</span>}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm gap-1"
                >
                  <Navigation className="size-3.5" /> Directions
                </a>
                {c.incident_id ? (
                  <Link href="/responder" className="btn btn-sm btn-ghost">
                    Escalated to incident
                  </Link>
                ) : (
                  c.status !== "dismissed" && (
                    <>
                      {c.status !== "confirmed" && (
                        <button type="button" className="btn btn-sm btn-warning" disabled={busy !== null} onClick={() => act(c.id, "confirm")}>
                          Confirm warning
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-error" disabled={busy !== null} onClick={() => act(c.id, "escalate")}>
                        Escalate to incident
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" disabled={busy !== null} onClick={() => act(c.id, "dismiss")}>
                        Dismiss
                      </button>
                    </>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
