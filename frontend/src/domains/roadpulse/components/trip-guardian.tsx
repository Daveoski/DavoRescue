"use client";

import { Check, Copy, MessageSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { clockTime } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { tripsApi } from "../api";
import { tripSchema } from "../schemas";
import type { Trip } from "../types";
import { tripStateMeta } from "./trip-state";

const DURATIONS = [30, 60, 90, 120, 180, 240];

function StartTrip({ onStarted }: { onStarted: (t: Trip) => void }) {
  const [destination, setDestination] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [contacts, setContacts] = useState([{ name: "", phone: "" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = tripSchema.safeParse({
      destination,
      eta_minutes: minutes,
      contacts: contacts.filter((c) => c.name.trim() || c.phone.trim()),
    });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) out[issue.path.join(".")] ??= issue.message;
      return setErrors(out);
    }
    setPending(true);
    try {
      onStarted(await tripsApi.start(parsed.data));
    } catch (err) {
      setErrors({ form: (err as ApiError).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Where are you going?</span>
        <input
          className={cn("input input-lg w-full", errors.destination && "input-error")}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. Nsukka, UNN main gate"
        />
        {errors.destination && <span className="mt-1 block text-sm text-error">{errors.destination}</span>}
      </label>

      <div>
        <p className="mb-1.5 text-sm font-medium">You expect to arrive in</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Expected journey time">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={cn("btn btn-sm rounded-full font-mono", minutes === m ? "btn-secondary" : "btn-ghost border-base-300")}
            >
              {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-base-content/60">Add a little extra for traffic and checkpoints — you can extend the time later.</p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Who should know if you don’t arrive?</p>
        <div className="space-y-2">
          {contacts.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={cn("input flex-1", errors[`contacts.${i}.name`] && "input-error")}
                placeholder="Name"
                value={c.name}
                onChange={(e) => setContacts((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className={cn("input flex-1", errors[`contacts.${i}.phone`] && "input-error")}
                placeholder="0803 123 4567"
                type="tel"
                inputMode="tel"
                value={c.phone}
                onChange={(e) => setContacts((cs) => cs.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
              />
              {contacts.length > 1 && (
                <button type="button" className="btn btn-ghost btn-square" aria-label="Remove contact" onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {Object.entries(errors).filter(([k]) => k.startsWith("contacts")).slice(0, 1).map(([k, v]) => (
          <span key={k} className="mt-1 block text-sm text-error">{v}</span>
        ))}
        {contacts.length < 3 && (
          <button type="button" className="btn btn-ghost btn-sm mt-2 gap-1" onClick={() => setContacts((cs) => [...cs, { name: "", phone: "" }])}>
            <Plus className="size-4" /> Add contact
          </button>
        )}
      </div>

      {errors.form && <p className="rounded-box bg-error/10 p-3 text-sm text-error">{errors.form}</p>}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending && <span className="loading loading-spinner loading-sm" />}
        Start trip
      </button>
    </form>
  );
}

function ActiveTrip({ trip, now, onChange }: { trip: Trip; now: number; onChange: (t: Trip | null) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const meta = tripStateMeta[trip.state];
  const minutesLeft = Math.round((new Date(trip.eta).getTime() - now) / 60_000);
  const share = encodeURIComponent(
    `I'm travelling to ${trip.destination}, expected by ${clockTime(trip.eta)}. Follow my trip on DavoRescue: ${trip.share_url}`,
  );

  async function act(key: string, call: () => Promise<Trip>, end = false) {
    setBusy(key);
    try {
      const updated = await call();
      onChange(end ? null : updated);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className={cn("rounded-box p-5", meta.panel)}>
        <p className="eyebrow !text-current opacity-75">{meta.label}</p>
        <h2 className="mt-1 text-3xl font-extrabold">To {trip.destination}</h2>
        <p className="mt-2">
          Expected by <strong className="font-mono">{clockTime(trip.eta)}</strong>
          {trip.state === "on_the_way" && ` · ${minutesLeft} min left`}
          {trip.state !== "on_the_way" && " · past your arrival time"}
        </p>
        {trip.state === "overdue" && (
          <p className="mt-2 text-sm">Your contacts have been alerted. Tap “I’ve arrived safely” to let them know you’re fine.</p>
        )}
      </section>

      <button type="button" className="btn btn-success btn-lg w-full" disabled={busy !== null} onClick={() => act("arrived", () => tripsApi.arrived(trip.id), true)}>
        {busy === "arrived" ? <span className="loading loading-spinner" /> : <Check className="size-5" />}
        I’ve arrived safely
      </button>
      <div className="grid grid-cols-3 gap-2">
        {[15, 30, 60].map((m) => (
          <button key={m} type="button" className="btn" disabled={busy !== null} onClick={() => act(`+${m}`, () => tripsApi.extend(trip.id, m))}>
            +{m} min
          </button>
        ))}
      </div>

      <section className="rounded-box border border-base-300 p-4">
        <p className="font-semibold">Share your trip</p>
        <p className="mt-1 text-sm text-base-content/70">
          {trip.contacts.length
            ? `${trip.contacts.map((c) => c.name).join(", ")} will be alerted if you’re 15 minutes overdue. `
            : ""}
          Anyone with the link can follow your progress until the trip ends.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${share}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm gap-1.5">
            <MessageSquare className="size-4" /> Send on WhatsApp
          </a>
          <button
            type="button"
            className="btn btn-sm gap-1.5"
            onClick={async () => {
              await navigator.clipboard?.writeText(trip.share_url).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/checkin" className="link">
          Check in on the road
        </Link>
        <button type="button" className="btn btn-ghost btn-sm text-base-content/60" disabled={busy !== null} onClick={() => act("cancel", () => tripsApi.cancel(trip.id), true)}>
          Cancel trip
        </button>
      </div>
      <p className="text-xs text-base-content/55">
        Keep this page open while you travel: it sends your position every minute so your contacts can see your last location.
      </p>
    </div>
  );
}

export function TripGuardian() {
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [now, setNow] = useState(0);

  usePoll(async () => {
    setNow(Date.now());
    const { trip: current } = await tripsApi.active().catch(() => ({ trip: null }));
    // Share the latest position while a trip is running.
    if (current && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => tripsApi.ping(current.id, p.coords.latitude, p.coords.longitude).then(setTrip).catch(() => undefined),
        () => undefined,
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
      );
    }
    setTrip(current);
  }, 60_000);

  if (trip === undefined) return <div className="skeleton h-64 w-full" />;
  return trip ? (
    <ActiveTrip trip={trip} now={now} onChange={setTrip} />
  ) : (
    <StartTrip
      onStarted={(t) => {
        setNow(Date.now());
        setTrip(t);
      }}
    />
  );
}
