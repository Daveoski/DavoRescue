"use client";

import { Check, Copy, MapPin, MessageSquare, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CallList } from "@/domains/agencies/components/call-list";
import { RoadBadge, SeverityBadge } from "@/domains/incidents/components/badges";
import type { ReportReceipt } from "@/domains/incidents/types";
import { site } from "@/shared/config/site";
import { cn } from "@/shared/lib/cn";
import { titleCase } from "@/shared/lib/format";

function PanicMeter({ score }: { score: number }) {
  const tone = score >= 75 ? "progress-error" : score >= 45 ? "progress-warning" : "progress-success";
  return (
    <div>
      <div className="flex justify-between text-xs text-base-content/60">
        <span>Urgency</span>
        <span className="font-mono tabular">{score}/100</span>
      </div>
      <progress className={cn("progress mt-1 h-2", tone)} value={score} max={100} />
    </div>
  );
}

export function Receipt({ receipt, onReportAnother }: { receipt: ReportReceipt; onReportAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  const v = receipt.verification;
  const verified = receipt.verdict === "true";
  const sent = receipt.dispatches.filter((d) => d.status === "sent");
  const agenciesPaged = [...new Set(sent.map((d) => d.agency_name))];

  const headline = !verified
    ? "We couldn't verify this report"
    : agenciesPaged.length
      ? `Verified — ${agenciesPaged.length} responder${agenciesPaged.length > 1 ? "s" : ""} alerted`
      : "Verified and logged for responders";

  const shareText = encodeURIComponent(
    `${titleCase(v.subtype)} reported via DavoRescue (${receipt.ref}). ${receipt.public_alert}\n${site.url}/incidents/${receipt.ref}`,
  );

  async function copyRef() {
    await navigator.clipboard?.writeText(receipt.ref).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8 pb-12">
      <header
        className={cn(
          "rounded-box p-5 sm:p-6",
          verified ? "bg-success text-success-content" : "bg-neutral text-neutral-content",
        )}
      >
        <div className="flex items-start gap-3">
          {verified ? <ShieldCheck className="mt-1 size-7 shrink-0" /> : <ShieldAlert className="mt-1 size-7 shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{headline}</h2>
            <p className="mt-2 opacity-90">{verified ? v.summary : "If this is real and people are in danger, call 112 now — don't wait."}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={copyRef} className="btn btn-sm border-current/30 bg-black/15 font-mono text-current hover:bg-black/25">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {receipt.ref}
          </button>
          <span className="text-sm opacity-85">
            Checked by {v.source === "ai" ? "the AI verification desk" : "automatic triage"} · {Math.round(v.confidence * 100)}% confident
          </span>
        </div>
      </header>

      {verified && !agenciesPaged.length && (
        <p className="rounded-box border border-warning/40 bg-warning/10 p-4 text-sm">
          Your report is on the live map and in the responder console, but automatic SMS/email paging isn&apos;t switched on for these
          agencies yet. <strong>Please call them directly below.</strong>
        </p>
      )}

      <CallList entries={receipt.call_list} />

      {receipt.advice && (
        <section className="rounded-box border-l-4 border-accent bg-base-200 p-4">
          <p className="eyebrow">Stay safe</p>
          <p className="mt-1">{receipt.advice}</p>
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="eyebrow">Assessment</p>
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {titleCase(v.subtype)} <SeverityBadge severity={v.severity} />
          </p>
          <PanicMeter score={v.panic_score} />
          <ul className="space-y-1 text-sm text-base-content/75">
            {v.reasons.map((r) => (
              <li key={r}>— {r}</li>
            ))}
          </ul>
          {!verified && v.red_flags.length > 0 && (
            <ul className="space-y-1 text-sm text-error">
              {v.red_flags.map((r) => (
                <li key={r}>! {r}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3">
          <p className="eyebrow">Location sent to responders</p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{receipt.road.summary}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <RoadBadge navigability={receipt.road.navigability} />
            {receipt.road.lga && <span className="badge badge-sm badge-ghost">{receipt.road.lga}</span>}
            <span className="badge badge-sm badge-ghost">{titleCase(receipt.road.state)}</span>
          </div>
          {receipt.people_alerted > 0 && (
            <p className="text-sm text-base-content/70">{receipt.people_alerted} people nearby were alerted to stay clear.</p>
          )}
        </div>
      </section>

      {receipt.dispatches.length > 0 && (
        <section>
          <p className="eyebrow mb-3">Dispatch log</p>
          <ul className="divide-y divide-base-300 rounded-box border border-base-300 text-sm">
            {receipt.dispatches.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  <span className="font-medium">{d.agency_name}</span>{" "}
                  <span className="text-base-content/55">· {d.channel.toUpperCase()}</span>
                </span>
                <span
                  className={cn(
                    "badge badge-sm",
                    d.status === "sent" ? "badge-success" : d.status === "failed" ? "badge-error badge-soft" : "badge-ghost",
                  )}
                  title={d.detail ?? undefined}
                >
                  {d.status === "sent" ? "Delivered" : d.status === "failed" ? "Failed" : "Not sent"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Only verified incidents are shareable, so the app never amplifies a hoax. */}
        {verified && (
          <>
            <Link href={`/incidents/${receipt.ref}`} className="btn btn-primary">
              Track this incident
            </Link>
            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="btn gap-2">
              <MessageSquare className="size-4" /> Share on WhatsApp
            </a>
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={onReportAnother}>
          Report something else
        </button>
      </div>
    </div>
  );
}
