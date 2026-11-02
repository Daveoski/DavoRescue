"use client";

import { Navigation, Phone, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { responderApi } from "@/domains/incidents/api";
import { RoadBadge, SeverityBadge, StatusBadge } from "@/domains/incidents/components/badges";
import { IncidentIcon } from "@/domains/incidents/components/incident-icon";
import type { IncidentStatus, ResponderDetail, ResponderRow } from "@/domains/incidents/types";
import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { clockTime, coords, prettyPhone, timeAgo, titleCase } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { ProtectedPhoto } from "./protected-photo";

const TABS: { id: string; label: string; status?: IncidentStatus[] }[] = [
  { id: "active", label: "Needs action", status: ["verified", "dispatched", "responding"] },
  { id: "review", label: "Not verified", status: ["rejected"] },
  { id: "resolved", label: "Resolved", status: ["resolved"] },
  { id: "all", label: "All" },
];

export function ResponderConsole() {
  const [tab, setTab] = useState(TABS[0]);
  const [rows, setRows] = useState<ResponderRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows(await responderApi.queue({ status: tab.status, hours: 72 }));
      setError(null);
    } catch (err) {
      setError((err as ApiError).message);
    }
  };

  usePoll(load, 15_000, tab.id);

  function switchTab(next: (typeof TABS)[number]) {
    setRows(null);
    setTab(next);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div role="tablist" className="tabs tabs-box tabs-sm">
            {TABS.map((t) => (
              <button key={t.id} role="tab" type="button" className={cn("tab", tab.id === t.id && "tab-active")} onClick={() => switchTab(t)}>
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={load} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </button>
        </div>
        {error && <p className="mb-3 rounded-box bg-error/10 p-3 text-sm text-error">{error}</p>}
        {!rows ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-box bg-base-200 p-6 text-sm">Nothing here in the last 72 hours.</p>
        ) : (
          <ul className="divide-y divide-base-300 overflow-hidden rounded-box border border-base-300">
            {rows.map((r) => {
              return (
                <li key={r.ref}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.ref)}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-base-200", selected === r.ref && "bg-base-200")}
                  >
                    <IncidentIcon
                      category={r.category}
                      subtype={r.subtype}
                      className={cn("mt-0.5 size-5 shrink-0", (r.severity ?? 0) >= 4 ? "text-error" : "text-base-content/60")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{titleCase(r.subtype)}</span>
                        <SeverityBadge severity={r.severity} />
                        <StatusBadge status={r.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-base-content/65">
                        {r.road_name ?? r.lga ?? coords(r.lat, r.lng, 4)} · {titleCase(r.state)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-xs text-base-content/55">
                      {clockTime(r.created_at)}
                      <span className="block">{r.ref}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        {selected ? (
          <IncidentPanel key={selected} incidentRef={selected} onClose={() => setSelected(null)} onChanged={load} />
        ) : (
          <div className="grid-paper hidden h-80 place-items-center rounded-box border border-dashed border-base-300 text-sm text-base-content/55 lg:grid">
            Select an incident to see evidence, AI reasoning and dispatch log.
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentPanel({ incidentRef, onClose, onChanged }: { incidentRef: string; onClose: () => void; onChanged: () => void }) {
  const [incident, setIncident] = useState<ResponderDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<IncidentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    responderApi.detail(incidentRef).then(setIncident).catch((e: ApiError) => setError(e.message));
  }, [incidentRef]);

  async function act(status: IncidentStatus) {
    setBusy(status);
    try {
      setIncident(await responderApi.setStatus(incidentRef, status, note.trim() || undefined));
      setNote("");
      onChanged();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="rounded-box bg-error/10 p-4 text-sm text-error">{error}</p>;
  if (!incident) return <div className="skeleton h-96 w-full" />;

  const i = incident;
  const target = i.access_lat && i.navigability !== "navigable" ? { lat: i.access_lat, lng: i.access_lng! } : { lat: i.lat, lng: i.lng };
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`;
  const callback = i.reporter?.phone ?? i.reporter_contact;

  const actions: { status: IncidentStatus; label: string; tone: string }[] =
    i.status === "rejected"
      ? [{ status: "verified", label: "Overrule — verify & dispatch", tone: "btn-primary" }]
      : i.status === "resolved"
        ? []
        : [
            { status: "responding", label: "Mark en route", tone: "btn-primary" },
            { status: "resolved", label: "Resolve", tone: "btn-success" },
            { status: "rejected", label: "False report", tone: "btn-ghost" },
          ];

  return (
    <article className="rounded-box border border-base-300 bg-base-100">
      <header className="flex items-start justify-between gap-3 border-b border-base-300 p-5">
        <div>
          <p className="eyebrow">
            {i.ref} · {timeAgo(i.created_at)}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{titleCase(i.subtype)}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <SeverityBadge severity={i.severity} />
            <StatusBadge status={i.status} />
            <RoadBadge navigability={i.navigability} />
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </button>
      </header>

      <div className="space-y-6 p-5">
        <section>
          <p className="eyebrow mb-1">Reporter&apos;s words</p>
          <p className="whitespace-pre-wrap text-[0.95rem]">{i.description}</p>
          <p className="mt-2 text-sm text-base-content/60">
            {i.is_anonymous ? "Anonymous" : i.reporter?.full_name}
            {i.injured_count !== null && ` · ${i.injured_count} injured reported`}
            {i.corroboration_count > 0 && ` · ${i.corroboration_count} other report(s) nearby`}
          </p>
          {callback && (
            <a href={`tel:${callback}`} className="btn btn-sm mt-3 gap-1.5 font-mono">
              <Phone className="size-3.5" /> Call reporter {prettyPhone(callback)}
            </a>
          )}
        </section>

        {i.media.length > 0 && (
          <section>
            <p className="eyebrow mb-2">Evidence</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {i.media.map((m) => (
                <figure key={m.id}>
                  <ProtectedPhoto src={`/api/responder/incidents/${i.ref}/media/${m.id}`} alt="Evidence photo" />
                  <figcaption className="mt-1 text-xs text-base-content/55">{m.live_capture ? "In-app camera" : "Uploaded"}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-box bg-base-200 p-4">
          <p className="eyebrow">
            Verification · {i.verification_source === "ai" ? "AI desk" : i.verification_source === "human" ? "Responder" : "Keyword triage"}
          </p>
          <p className="mt-1 font-medium">
            {i.verdict === "true" ? "Genuine" : "Not verified"}
            {i.confidence !== null && ` · ${Math.round(i.confidence * 100)}% confidence`}
            {i.panic_score !== null && ` · urgency ${i.panic_score}/100`}
          </p>
          {i.ai_summary && <p className="mt-2 text-sm">{i.ai_summary}</p>}
          <ul className="mt-2 space-y-0.5 text-sm text-base-content/70">
            {i.ai_reasons.map((r) => (
              <li key={r}>— {r}</li>
            ))}
            {i.ai_red_flags.map((r) => (
              <li key={r} className="text-error">
                ! {r}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="eyebrow mb-1">Location</p>
          <p className="font-medium">{i.road_name ?? "Unnamed / off-road"}</p>
          <p className="text-sm text-base-content/65">{i.address}</p>
          <p className="mt-1 font-mono text-xs tabular">
            {coords(i.lat, i.lng, 6)}
            {i.accuracy_m ? ` ±${Math.round(i.accuracy_m)} m` : " (placed by hand)"}
          </p>
          {i.navigability !== "navigable" && i.access_distance_m && (
            <p className="mt-2 text-sm">
              Not motorable — nearest vehicle access is <strong>{Math.round(i.access_distance_m)} m</strong> away. Directions go to
              that access point.
            </p>
          )}
          <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary mt-3 gap-1.5">
            <Navigation className="size-4" /> Directions
          </a>
        </section>

        {i.dispatches.length > 0 && (
          <section>
            <p className="eyebrow mb-2">Dispatch log</p>
            <ul className="space-y-1 text-sm">
              {i.dispatches.map((d, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>
                    {d.agency_name ?? "—"} · {d.channel.toUpperCase()} {d.target}
                  </span>
                  <span className={cn(d.status === "sent" ? "text-success" : d.status === "failed" ? "text-error" : "text-base-content/50")}>
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <p className="eyebrow mb-2">Timeline</p>
          <ol className="space-y-2 border-l border-base-300 pl-4 text-sm">
            {i.events.map((e, idx) => (
              <li key={idx}>
                <span className="font-mono text-xs text-base-content/55">{clockTime(e.created_at)}</span>{" "}
                <span className="font-medium">{titleCase(e.kind)}</span>
                {e.actor && <span className="text-base-content/60"> · {e.actor}</span>}
                {e.note && <span className="block text-base-content/70">{e.note}</span>}
              </li>
            ))}
          </ol>
        </section>

        {actions.length > 0 && (
          <section className="border-t border-base-300 pt-5">
            <input
              className="input input-sm mb-3 w-full"
              placeholder="Add a note for the log (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button key={a.status} type="button" className={cn("btn btn-sm", a.tone)} onClick={() => act(a.status)} disabled={busy !== null}>
                  {busy === a.status && <span className="loading loading-spinner loading-xs" />}
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
