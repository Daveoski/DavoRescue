"use client";

import { Camera, Check, LocateFixed, Phone, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth, useSessionReady } from "@/domains/auth/store";
import { incidentsApi } from "@/domains/incidents/api";
import { incidentTypes, quickFacts, type IncidentType } from "@/domains/incidents/catalogue";
import { RoadBadge } from "@/domains/incidents/components/badges";
import type { ReportReceipt, RoadContext } from "@/domains/incidents/types";
import { LocationPicker } from "@/domains/map/components/lazy";
import { InlineStreetView } from "@/domains/map/components/street-view-panel";
import { STREET_VIEW_ZOOM } from "@/domains/map/street-view";
import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { coords } from "@/shared/lib/format";
import { useGeolocation } from "@/shared/lib/use-geolocation";

import type { EvidencePhoto } from "../lib/photo";
import { CameraCapture } from "./camera-capture";
import { Receipt } from "./receipt";
import { SubmitProgress } from "./submit-progress";

const ENUGU: [number, number] = [6.4584, 7.5464];
const MAX_PHOTOS = 3;

type Pin = { lat: number; lng: number; accuracy: number | null; manual: boolean };

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="border-t border-base-300 py-6 first:border-t-0 first:pt-0">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-bold">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full font-mono text-sm",
            done ? "bg-success text-success-content" : "bg-secondary text-secondary-content",
          )}
          aria-hidden
        >
          {done ? <Check className="size-4" /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ReportForm() {
  const ready = useSessionReady();
  const user = useAuth((s) => s.user);
  const signedIn = ready && Boolean(user);

  const [type, setType] = useState<IncidentType | null>(null);
  const [manualPin, setManualPin] = useState<Pin | null>(null);
  const [mapZoom, setMapZoom] = useState(0);
  const [roadResult, setRoadResult] = useState<{ key: string; ctx: RoadContext | null } | null>(null);
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [injured, setInjured] = useState<number | null>(null);
  const [anonymousChoice, setAnonymousChoice] = useState<boolean | null>(null);
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);

  const geo = useGeolocation(true);

  // Follow the GPS until the reporter places the pin by hand.
  const pin: Pin | null =
    manualPin ?? (geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy, manual: false } : null);
  // Signed-in reporters default to identifiable so responders can call back.
  const anonymous = anonymousChoice ?? !signedIn;

  const pinKey = pin ? `${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}` : null;
  const road = roadResult?.ctx ?? null;
  const roadLoading = pinKey !== null && roadResult?.key !== pinKey;

  useEffect(() => {
    if (!pinKey) return;
    let cancelled = false;
    const [lat, lng] = pinKey.split(",").map(Number);
    const timer = setTimeout(() => {
      incidentsApi
        .roadContext(lat, lng)
        .then((ctx) => !cancelled && setRoadResult({ key: pinKey, ctx }))
        .catch(() => !cancelled && setRoadResult({ key: pinKey, ctx: null }));
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pinKey]);

  const movePin = useCallback((lat: number, lng: number) => setManualPin({ lat, lng, accuracy: null, manual: true }), []);

  const addFact = (fact: string) =>
    setDescription((d) => (d.toLowerCase().includes(fact.toLowerCase()) ? d : `${d.trim()}${d.trim() ? ". " : ""}${fact}`));

  const missing = [!type && "what's happening", !pin && "the location", description.trim().length < 3 && "a short description"].filter(
    Boolean,
  ) as string[];

  async function submit() {
    if (!type || !pin || missing.length) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await incidentsApi.report({
        category: type.category,
        subtype: type.subtype,
        description: description.trim(),
        lat: pin.lat,
        lng: pin.lng,
        accuracy_m: pin.manual ? null : pin.accuracy,
        injured_count: injured,
        anonymous: !signedIn || anonymous,
        contact_phone: !signedIn && contact.trim() ? contact.trim() : null,
        photos: photos.map((p) => ({ data_url: p.dataUrl, captured_at: p.capturedAt, lat: p.lat, lng: p.lng, live_capture: p.live })),
      });
      setReceipt(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setReceipt(null);
    setType(null);
    setPhotos([]);
    setDescription("");
    setInjured(null);
    setManualPin(null);
    geo.retry();
  }

  if (receipt) return <Receipt receipt={receipt} onReportAnother={reset} />;

  return (
    <div className="pb-32">
      <Step n={1} title="What's happening?" done={Boolean(type)}>
        <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Type of emergency">
          {incidentTypes.map((t) => {
            const active = type?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(t)}
                className={cn(
                  "group flex min-h-24 flex-col items-start justify-between rounded-box border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-content"
                    : "border-base-300 bg-base-100 hover:border-base-content/40",
                )}
              >
                <t.Icon className={cn("size-6", active ? "" : "text-primary")} aria-hidden />
                <span>
                  <span className="block font-display text-[0.95rem] font-bold leading-tight sm:text-base">{t.label}</span>
                  <span className={cn("hidden text-xs leading-snug sm:block", active ? "opacity-85" : "text-base-content/60")}>
                    {t.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={2} title="Where is it?" done={Boolean(pin)}>
        <div className="relative h-72 overflow-hidden rounded-box border border-base-300 sm:h-80">
          <LocationPicker
            position={pin}
            accuracy={pin?.accuracy ?? null}
            road={road}
            fallbackCenter={ENUGU}
            onMove={movePin}
            onZoomChange={setMapZoom}
          />
        </div>
        {pin && mapZoom >= STREET_VIEW_ZOOM && (
          <div className="mt-3">
            <InlineStreetView target={pin} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            {pin ? (
              <>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {roadLoading ? <span className="loading loading-dots loading-xs" /> : road && <RoadBadge navigability={road.navigability} />}
                  <span>{road?.summary ?? (roadLoading ? "Checking the road…" : "Exact GPS position")}</span>
                </p>
                <p className="mt-1 font-mono text-xs text-base-content/60 tabular">
                  {coords(pin.lat, pin.lng)}
                  {pin.manual ? " · placed by hand" : pin.accuracy ? ` · ±${Math.round(pin.accuracy)} m` : ""}
                  {road?.lga ? ` · ${road.lga}` : ""}
                </p>
              </>
            ) : geo.status === "error" ? (
              <p className="text-sm text-warning">{geo.error}</p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-base-content/70">
                <span className="loading loading-ring loading-sm" /> Finding you…
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm gap-1.5"
            onClick={() => {
              setManualPin(null);
              geo.retry();
            }}
          >
            <LocateFixed className="size-4" /> Use my GPS
          </button>
        </div>
        <p className="mt-2 text-xs text-base-content/60">
          Not where it’s happening? Drag the pin or tap the map — works on footpaths and bush tracks too. Zoom in to check the spot in
          Street View.
        </p>
      </Step>

      <Step n={3} title="Show what you see" done={photos.length > 0}>
        <p className="mb-3 text-sm text-base-content/70">
          Optional, but it helps us verify fast. Only take photos if it’s safe — never approach attackers.
        </p>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <figure key={p.id} className="relative size-24 overflow-hidden rounded-field border border-base-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt="Evidence photo" className="size-full object-cover" />
              <button
                type="button"
                className="btn btn-circle btn-xs absolute right-1 top-1"
                aria-label="Remove photo"
                onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))}
              >
                <Trash2 className="size-3" />
              </button>
            </figure>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-field border-2 border-dashed border-base-300 text-sm font-medium hover:border-primary hover:text-primary"
            >
              <Camera className="size-6" /> Camera
            </button>
          )}
        </div>
      </Step>

      <Step n={4} title="Tell responders what matters" done={description.trim().length >= 3}>
        <textarea
          className="textarea textarea-lg min-h-32 w-full"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Four armed men stopped a bus near Ugwu Onyeama, heading towards 9th Mile. One person shot."
          aria-label="Describe what is happening"
        />
        <p className="mt-1 text-xs text-base-content/55">English, Pidgin or Igbo — write it however is fastest.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickFacts.map((fact) => (
            <button key={fact} type="button" className="btn btn-sm btn-soft rounded-full" onClick={() => addFact(fact)}>
              + {fact}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium">People injured</span>
          <div className="join">
            <button type="button" className="btn btn-sm join-item" onClick={() => setInjured((n) => (n ? n - 1 : null))} aria-label="Fewer">
              −
            </button>
            <span className="btn btn-sm join-item pointer-events-none w-14 font-mono tabular">{injured ?? "?"}</span>
            <button type="button" className="btn btn-sm join-item" onClick={() => setInjured((n) => (n ?? 0) + 1)} aria-label="More">
              +
            </button>
          </div>
        </div>
      </Step>

      <Step n={5} title="Who's reporting">
        {signedIn ? (
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="toggle toggle-sm mt-0.5" checked={anonymous} onChange={(e) => setAnonymousChoice(e.target.checked)} />
            <span className="text-sm">
              <span className="font-medium">Send anonymously</span>
              <span className="block text-base-content/65">
                {anonymous
                  ? "Responders won't see your name or number."
                  : `Responders can call you back on ${user?.phone}.`}
              </span>
            </span>
          </label>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-base-content/75">
              You’re reporting <strong>anonymously</strong> — no account needed. Add a number only if you’re happy for responders to call
              you back.{" "}
              <Link href="/signin?next=/report" className="link">
                Sign in
              </Link>{" "}
              to get alerts near you.
            </p>
            <label className="input w-full max-w-sm">
              <Phone className="size-4 opacity-60" />
              <input type="tel" inputMode="tel" placeholder="Callback number (optional)" value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
          </div>
        )}
      </Step>

      {error && (
        <p role="alert" className="mb-4 rounded-box bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-[500] border-t border-base-300 bg-base-100/95 backdrop-blur supports-[backdrop-filter]:bg-base-100/85">
        <div className="wrap flex items-center gap-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a href="tel:112" className="btn btn-outline btn-lg shrink-0 font-mono" aria-label="Call 112">
            <Phone className="size-5" /> 112
          </a>
          <button type="button" className="btn btn-primary btn-lg flex-1" disabled={submitting || missing.length > 0} onClick={submit}>
            {submitting ? <span className="loading loading-spinner" /> : <Send className="size-5" />}
            Send report
          </button>
        </div>
        {missing.length > 0 && (
          <p className="wrap -mt-2 pb-2 text-xs text-base-content/60">Add {missing.join(", ")} to send.</p>
        )}
      </div>

      <CameraCapture
        open={cameraOpen}
        remaining={MAX_PHOTOS - photos.length}
        lat={pin?.lat ?? geo.fix?.lat ?? null}
        lng={pin?.lng ?? geo.fix?.lng ?? null}
        onCapture={(p) => setPhotos((ps) => [...ps, p].slice(0, MAX_PHOTOS))}
        onClose={() => setCameraOpen(false)}
      />
      {submitting && <SubmitProgress hasPhotos={photos.length > 0} />}
    </div>
  );
}
