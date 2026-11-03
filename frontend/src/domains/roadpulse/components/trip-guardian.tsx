"use client";

import { Check, Copy, Mail, MessageSquare, Plus, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { clockTime, timeAgo } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { tripsApi } from "../api";
import { tripSchema } from "../schemas";
import type { Delivery, Trip } from "../types";
import { tripStateMeta } from "./trip-state";
import { useLiveLocation, type LiveStatus } from "./use-live-location";

const DURATIONS = [30, 60, 90, 120, 180, 240];
const MESSAGE_MAX = 200;
const blankContact = { name: "", phone: "", email: "" };

function StartTrip({ onStarted }: { onStarted: (t: Trip) => void }) {
  const [destination, setDestination] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [message, setMessage] = useState("");
  const [contacts, setContacts] = useState([blankContact]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const setContact = (i: number, key: keyof typeof blankContact, value: string) =>
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: value } : c)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = tripSchema.safeParse({
      destination,
      eta_minutes: minutes,
      message,
      contacts: contacts.filter((c) => c.name.trim() || c.phone.trim() || c.email.trim()),
    });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) out[issue.path.join(".")] ??= issue.message;
      return setErrors(out);
    }
    setErrors({});
    setPending(true);
    try {
      onStarted(await tripsApi.start(parsed.data));
    } catch (err) {
      setErrors({ form: (err as ApiError).message });
    } finally {
      setPending(false);
    }
  }

  const contactError = Object.entries(errors).find(([k]) => k.startsWith("contacts"))?.[1];

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
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
        <p className="text-sm font-medium">Who should follow your trip?</p>
        <p className="mb-2 text-xs text-base-content/60">Up to three people. Email is optional.</p>
        <div className="space-y-2.5">
          {contacts.map((c, i) => (
            <div key={i} className="rounded-box border border-base-300 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-base-content/50">Contact {i + 1}</span>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs gap-1 text-base-content/60"
                    onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={cn("input w-full", errors[`contacts.${i}.name`] && "input-error")}
                  aria-label={`Contact ${i + 1} name`}
                  placeholder="Name, e.g. Mum"
                  value={c.name}
                  onChange={(e) => setContact(i, "name", e.target.value)}
                />
                <input
                  className={cn("input w-full", errors[`contacts.${i}.phone`] && "input-error")}
                  aria-label={`Contact ${i + 1} phone number`}
                  placeholder="0803 123 4567"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={c.phone}
                  onChange={(e) => setContact(i, "phone", e.target.value)}
                />
                <input
                  className={cn("input w-full sm:col-span-2", errors[`contacts.${i}.email`] && "input-error")}
                  aria-label={`Contact ${i + 1} email (optional)`}
                  placeholder="Email (optional)"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={c.email}
                  onChange={(e) => setContact(i, "email", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        {contactError && <span className="mt-1 block text-sm text-error">{contactError}</span>}
        {contacts.length < 3 && (
          <button type="button" className="btn btn-ghost btn-sm mt-2 gap-1" onClick={() => setContacts((cs) => [...cs, blankContact])}>
            <Plus className="size-4" /> Add contact
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
          Message for them <span className="text-xs font-normal text-base-content/50">optional</span>
        </span>
        <textarea
          className={cn("textarea w-full text-base", errors.message && "textarea-error")}
          rows={3}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Leaving Ogui Road with Chidi in his grey Corolla. I’ll call when I reach UNN main gate."
        />
        <span className="mt-1 flex justify-between gap-3 text-xs text-base-content/55">
          <span>{errors.message ?? "Who you’re with, the car, the route — anything that would help them find you."}</span>
          <span className="font-mono tabular">
            {message.length}/{MESSAGE_MAX}
          </span>
        </span>
      </label>

      <p className="rounded-box bg-base-200 p-4 text-sm text-base-content/80">
        Each contact gets a text, and an email if you added one, with your message and a link to follow your live location. If
        you haven’t checked in 15 minutes after your arrival time, they’re alerted again with your last position.
      </p>

      {errors.form && <p className="rounded-box bg-error/10 p-3 text-sm text-error">{errors.form}</p>}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending && <span className="loading loading-spinner loading-sm" />}
        Start trip and notify contacts
      </button>
    </form>
  );
}

const liveMeta: Record<LiveStatus, { dot: string; text: string }> = {
  starting: { dot: "bg-base-content/40", text: "Getting your location…" },
  live: { dot: "bg-success animate-pulse", text: "Sharing live location" },
  searching: { dot: "bg-warning", text: "Looking for a GPS signal" },
  blocked: { dot: "bg-error", text: "Location is blocked. Allow it in your browser settings so your contacts can follow you." },
  unsupported: { dot: "bg-error", text: "This device can’t share its location." },
};

const channelLabel = { sms: "Text", email: "Email" } as const;
const statusWord: Record<Delivery["status"], string> = { sent: "sent", failed: "failed", skipped: "not sent" };
const statusTone: Record<Delivery["status"], string> = {
  sent: "badge-success badge-soft",
  failed: "badge-error badge-soft",
  skipped: "badge-ghost",
};

function DeliveryBadge({ delivery }: { delivery: Delivery }) {
  const Icon = delivery.channel === "sms" ? Smartphone : Mail;
  return (
    <span className={cn("badge badge-sm gap-1", statusTone[delivery.status])} title={delivery.detail ?? undefined}>
      <Icon className="size-3" aria-hidden /> {channelLabel[delivery.channel]} {statusWord[delivery.status]}
    </span>
  );
}

function ActiveTrip({ trip, now, onChange }: { trip: Trip; now: number; onChange: (t: Trip | null) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const live = useLiveLocation(trip.id, (t) => onChange(t));
  const meta = tripStateMeta[trip.state];
  const minutesLeft = Math.round((new Date(trip.eta).getTime() - now) / 60_000);
  const missed = trip.deliveries.some((d) => d.status !== "sent");
  const share = encodeURIComponent(
    `I'm travelling to ${trip.destination}, expected by ${clockTime(trip.eta)}. Follow my live location on DavoRescue: ${trip.share_url}`,
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
          <p className="mt-2 text-sm">Your contacts have been alerted with your last location. Tap “I’ve arrived safely” to let them know you’re fine.</p>
        )}
        <p className="mt-4 flex items-start gap-2 text-sm" role="status">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", liveMeta[live].dot)} aria-hidden />
          <span>
            {liveMeta[live].text}
            {live === "live" && trip.last_seen_at && <span className="opacity-70"> · sent {timeAgo(trip.last_seen_at, now || undefined)}</span>}
          </span>
        </p>
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

      {trip.contacts.length > 0 && (
        <section className="rounded-box border border-base-300 p-4">
          <p className="font-semibold">Who’s been told</p>
          <ul className="mt-2 divide-y divide-base-300">
            {trip.contacts.map((c) => (
              <li key={`${c.name}-${c.phone}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm">
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="font-mono text-xs text-base-content/55">{c.phone}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {trip.deliveries
                    .filter((d) => d.to === c.name)
                    .map((d) => (
                      <DeliveryBadge key={d.channel} delivery={d} />
                    ))}
                </span>
              </li>
            ))}
          </ul>
          {trip.message && (
            <blockquote className="mt-3 border-l-4 border-secondary bg-base-200 px-3 py-2 text-sm">{trip.message}</blockquote>
          )}
          {missed && (
            <p className="mt-3 text-xs text-base-content/65">
              Some messages couldn’t go out automatically. Send your link on WhatsApp below so they can still follow you.
            </p>
          )}
        </section>
      )}

      <section className="rounded-box border border-base-300 p-4">
        <p className="font-semibold">Your live location link</p>
        <p className="mt-1 text-sm text-base-content/70">
          Anyone with this link can follow your live location until you arrive or end the trip.
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
        Keep this page open while you travel. It sends your position every 20 seconds; if you close it, your contacts see the last
        place it was sent from.
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
    setTrip(current);
  }, 30_000);

  if (trip === undefined) return <div className="skeleton h-64 w-full" />;
  return trip ? (
    <ActiveTrip
      trip={trip}
      now={now}
      onChange={(t) => {
        setNow(Date.now());
        // A late location ping must not bring back a trip that has just ended.
        setTrip((cur) => (t === null ? null : cur && cur.id === t.id ? t : cur));
      }}
    />
  ) : (
    <StartTrip
      onStarted={(t) => {
        setNow(Date.now());
        setTrip(t);
      }}
    />
  );
}
