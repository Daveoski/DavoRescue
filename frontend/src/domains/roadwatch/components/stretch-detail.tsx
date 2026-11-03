import { Activity, Satellite, ShieldAlert, X } from "lucide-react";
import Link from "next/link";

import { signLabel, statusMeta } from "@/domains/roadpulse/catalogue";

import { cn } from "@/shared/lib/cn";
import { timeAgo, titleCase } from "@/shared/lib/format";

import { displayLevel, hazardLabel, settlementLabel, surfaceLabel } from "../api";
import type { Corridor, Stretch } from "../types";

function imageryWhen(date: string | null, res: number | null): string {
  if (!date) return "Imagery date unknown";
  const when = new Date(date).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  return `Imagery from ${when}${res ? ` · ${res < 1 ? `${Math.round(res * 100)} cm` : `${res} m`} detail` : ""}`;
}

export function StretchDetail({ corridor, stretch, onClose }: { corridor: Corridor; stretch: Stretch; onClose: () => void }) {
  const a = stretch.assessment;
  const meta = displayLevel(stretch);

  return (
    <article className="rounded-box border border-base-300 bg-base-100">
      <header className="flex items-start justify-between gap-3 border-b border-base-300 p-5">
        <div>
          <p className="eyebrow">
            {corridor.name} · stretch {stretch.seq}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">{titleCase(stretch.label)}</h2>
          <p className="mt-1 text-sm text-base-content/65">
            {stretch.lga && `${stretch.lga} LGA · `}
            {(stretch.length_m / 1000).toFixed(1)} km
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label="Close details">
          <X className="size-4" />
        </button>
      </header>

      <div className="space-y-6 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("badge badge-lg", meta.badge)}>{meta.label}</span>
          {meta.key !== "pending" && <span className="font-mono text-sm tabular text-base-content/60">risk {stretch.risk}/100</span>}
        </div>

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5">
            <Activity className="size-3.5" aria-hidden /> Right now
          </h3>
          {stretch.warnings.length > 0 && (
            <ul className="mb-3 space-y-2">
              {stretch.warnings.map((w) => (
                <li key={w.id} className="rounded-field border border-warning/40 bg-warning/10 p-3 text-sm">
                  <p className="font-semibold">{w.signs.map((s) => signLabel[s] ?? s).join(" · ")}</p>
                  <p className="text-xs text-base-content/70">
                    <span className={cn("badge badge-xs mr-1", statusMeta[w.status].badge)}>{statusMeta[w.status].label}</span>
                    {w.sources} source{w.sources > 1 ? "s" : ""} · last report {timeAgo(w.last_seen)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm">
            {stretch.pulse.all_clear_3h > 0
              ? `${stretch.pulse.all_clear_3h} driver${stretch.pulse.all_clear_3h > 1 ? "s" : ""} reported all clear in the last 3 hours, latest ${timeAgo(stretch.pulse.last_all_clear!)}.`
              : "No driver check-ins in the last 3 hours."}
            {stretch.pulse.turning_back_1h > 0 && (
              <strong className="block text-warning">
                {stretch.pulse.turning_back_1h} report{stretch.pulse.turning_back_1h > 1 ? "s" : ""} of vehicles turning back in the last hour.
              </strong>
            )}
          </p>
          <Link href="/checkin" className="link mt-1 inline-block text-sm">
            Travelling this road? Check in
          </Link>
        </section>

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5">
            <ShieldAlert className="size-3.5" aria-hidden /> Reported incidents
          </h3>
          {stretch.incidents_90d === 0 ? (
            <p className="text-sm">No verified incidents within 300 m of this stretch in the last 90 days.</p>
          ) : (
            <>
              <p className="text-sm">
                <strong>{stretch.incidents_90d}</strong> verified incident{stretch.incidents_90d > 1 ? "s" : ""} within 300 m in the last
                90 days.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {stretch.recent_incidents.map((i) => (
                  <li key={i.ref}>
                    <Link href={`/incidents/${i.ref}`} className="link link-hover">
                      {titleCase(i.subtype)}
                    </Link>{" "}
                    <span className="text-base-content/55">· {timeAgo(i.created_at)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-1.5">
            <Satellite className="size-3.5" aria-hidden /> Satellite review
          </h3>
          {!a ? (
            <p className="text-sm text-base-content/70">This stretch hasn’t been reviewed yet. It’s in the queue for the next scan.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>{a.summary}</p>
              {a.advice && <p className="rounded-field border-l-4 border-accent bg-base-200 px-3 py-2 font-medium">{a.advice}</p>}
              {a.hazards.length > 0 && (
                <ul className="space-y-1.5">
                  {a.hazards.map((h, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className={cn("badge badge-sm shrink-0", h.severity >= 3 ? "badge-error" : h.severity === 2 ? "badge-warning" : "badge-ghost")}>
                        {hazardLabel[h.type] ?? h.type}
                      </span>
                      <span className="text-base-content/80">{h.note}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-1.5">
                {a.settlement && <span className="badge badge-sm badge-ghost">{settlementLabel[a.settlement] ?? a.settlement}</span>}
                {a.surface && <span className="badge badge-sm badge-ghost">{surfaceLabel[a.surface] ?? a.surface}</span>}
                {a.vegetation_pct !== null && <span className="badge badge-sm badge-ghost">{a.vegetation_pct}% vegetation beside road</span>}
              </div>
              <p className="text-xs text-base-content/55">
                {a.method === "ai" ? "Reviewed by AI" : "Measured from imagery; detailed AI review pending"} · {imageryWhen(a.imagery_date, a.imagery_res_m)} ·
                checked {timeAgo(a.scanned_at)}
              </p>
            </div>
          )}
        </section>

        <p className="text-xs leading-relaxed text-base-content/55">
          Satellite photos show the road and its surroundings, not what is happening right now. Reported incidents carry the most
          weight. Zoom right in on the map to check the stretch in Street View.
        </p>

        <Link href="/report" className="btn btn-primary btn-sm">
          Report something on this road
        </Link>
      </div>
    </article>
  );
}
