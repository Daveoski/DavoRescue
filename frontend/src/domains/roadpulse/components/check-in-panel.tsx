"use client";

import { CircleCheck, Siren, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { coords } from "@/shared/lib/format";
import { useGeolocation } from "@/shared/lib/use-geolocation";

import { pulseApi } from "../api";
import { signs, statusMeta, TurningBackIcon } from "../catalogue";
import type { Sign, SignalKind, SignalResult } from "../types";

export function CheckInPanel() {
  const geo = useGeolocation(true);
  const [warningOpen, setWarningOpen] = useState(false);
  const [sign, setSign] = useState<Sign | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState<SignalKind | null>(null);
  const [result, setResult] = useState<SignalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: SignalKind) {
    if (!geo.fix) return;
    setSending(kind);
    setError(null);
    try {
      setResult(
        await pulseApi.send({
          kind,
          sign: kind === "warning" ? (sign ?? undefined) : undefined,
          note: kind === "warning" && note.trim() ? note.trim() : undefined,
          lat: geo.fix.lat,
          lng: geo.fix.lng,
          accuracy_m: geo.fix.accuracy,
        }),
      );
      setWarningOpen(false);
      setSign(null);
      setNote("");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSending(null);
    }
  }

  const located = Boolean(geo.fix);
  const big = "btn btn-lg h-auto min-h-20 w-full justify-start gap-4 py-4 text-left";

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        {located ? (
          <>
            <span className="size-2 rounded-full bg-success" />
            <span className="font-mono text-xs tabular text-base-content/70">
              {coords(geo.fix!.lat, geo.fix!.lng, 4)} · ±{Math.round(geo.fix!.accuracy)} m
            </span>
          </>
        ) : geo.status === "error" ? (
          <span className="text-warning">
            We can’t see your location. Allow location for this site (or turn on GPS) so we know which road you’re on.{" "}
            <button type="button" className="link font-medium" onClick={geo.retry}>
              Try again
            </button>
          </span>
        ) : (
          <>
            <span className="loading loading-ring loading-xs" /> Finding your position…
          </>
        )}
      </p>

      {result && (
        <div
          role="status"
          className={cn("rounded-box border p-4", result.kind === "all_clear" ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10")}
        >
          <p className="font-semibold">{result.message}</p>
          <p className="mt-1 text-sm text-base-content/70">
            {result.segment ? `${result.segment.corridor_name}, ${result.segment.label}` : "Not on a major road we track — still recorded."}
            {result.status !== "recorded" && result.status !== "dismissed" && (
              <span className={cn("badge badge-sm ml-2", statusMeta[result.status].badge)}>{statusMeta[result.status].label}</span>
            )}
            {result.people_alerted > 0 && ` · ${result.people_alerted} people nearby alerted`}
          </p>
        </div>
      )}
      {error && <p className="rounded-box bg-error/10 p-3 text-sm text-error">{error}</p>}

      <div className="grid gap-3">
        <button type="button" className={cn(big, "btn-success")} disabled={!located || sending !== null} onClick={() => send("all_clear")}>
          {sending === "all_clear" ? <span className="loading loading-spinner" /> : <CircleCheck className="size-8 shrink-0" />}
          <span>
            <span className="block text-lg font-bold">All clear here</span>
            <span className="block text-sm font-normal opacity-85">Road open, traffic moving normally</span>
          </span>
        </button>

        <button type="button" className={cn(big, "btn-warning")} disabled={!located || sending !== null} onClick={() => send("turning_back")}>
          {sending === "turning_back" ? <span className="loading loading-spinner" /> : <TurningBackIcon className="size-8 shrink-0" />}
          <span>
            <span className="block text-lg font-bold">Vehicles turning back</span>
            <span className="block text-sm font-normal opacity-85">Cars ahead are stopping or turning round</span>
          </span>
        </button>

        <button
          type="button"
          className={cn(big, warningOpen ? "btn-error" : "btn-error btn-outline")}
          disabled={!located}
          onClick={() => setWarningOpen((o) => !o)}
          aria-expanded={warningOpen}
        >
          <TriangleAlert className="size-8 shrink-0" />
          <span>
            <span className="block text-lg font-bold">I see a warning sign</span>
            <span className="block text-sm font-normal opacity-85">Something suspicious, before anything has happened</span>
          </span>
        </button>
      </div>

      {warningOpen && (
        <section className="space-y-4 rounded-box border border-error/30 p-4">
          <p className="font-semibold">What did you see?</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Warning sign">
            {signs.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sign === s.id}
                onClick={() => setSign(s.id)}
                className={cn(
                  "flex items-center gap-3 rounded-field border p-3 text-left text-sm",
                  sign === s.id ? "border-error bg-error text-error-content" : "border-base-300 hover:border-base-content/40",
                )}
              >
                <s.Icon className="size-5 shrink-0" aria-hidden />
                {s.label}
              </button>
            ))}
          </div>
          <input
            className="input w-full"
            maxLength={280}
            placeholder="Anything else? e.g. three men, black Sienna, heading to Oji (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" className="btn btn-error w-full" disabled={!sign || sending !== null} onClick={() => send("warning")}>
            {sending === "warning" && <span className="loading loading-spinner loading-sm" />}
            Send warning
          </button>
          <p className="text-xs text-base-content/60">
            Responders see your warning straight away. It’s shown to other drivers once someone else confirms it, so one
            mistaken report can’t start a panic.
          </p>
        </section>
      )}

      <div className="rounded-box bg-base-200 p-4 text-sm">
        <p>
          Someone in danger right now?{" "}
          <Link href="/report" className="link link-primary font-semibold">
            Report an emergency
          </Link>{" "}
          or call <a href="tel:112" className="link font-mono font-semibold">112</a>.
        </p>
        <p className="mt-2">
          <Siren className="mr-1.5 inline size-4 align-[-3px] text-primary" aria-hidden />
          Travelling?{" "}
          <Link href="/trip" className="link font-semibold">
            Start a trip
          </Link>{" "}
          so someone knows if you don’t arrive.
        </p>
      </div>
    </div>
  );
}
