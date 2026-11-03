"use client";

import { ExternalLink, Maximize2, Minimize2, PersonStanding, X } from "lucide-react";
import dynamic from "next/dynamic";

import { cn } from "@/shared/lib/cn";
import { distance } from "@/shared/lib/format";
import { distanceMeters, type LatLng } from "@/shared/lib/geo";

import {
  captureMonth,
  GOOGLE_RADIUS_M,
  googleEmbedEnabled,
  googleEmbedUrl,
  googleMonth,
  googleStreetViewUrl,
  mapillaryUrl,
  NEAR_M,
  SEARCH_STEPS_M,
  streetViewEnabled,
  type StreetImage,
} from "../street-view";
import { useStreetView, type StreetSource } from "../use-street-image";

// WebGL viewer: browser-only, and its ~1 MB bundle loads only when it's shown.
const MapillaryViewer = dynamic(() => import("./mapillary-viewer"), {
  ssr: false,
  loading: () => <Spinner label="Loading street photo" />,
});

export type StreetViewSubject = "pin" | "incident" | "map centre";
export type StreetViewState = ReturnType<typeof useStreetView>;

type PanelProps = {
  target: LatLng;
  subject: StreetViewSubject;
  view: StreetViewState;
  /** A Mapillary photo the user tapped on the map; shown instead of the automatic pick. */
  picked?: StreetImage | null;
  variant: "overlay" | "inline";
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
  onWalk?: (image: { id: string; position: LatLng }) => void;
};

function Spinner({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <span className="loading loading-dots loading-md opacity-60" aria-label={label} />
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="btn btn-ghost btn-xs btn-square text-current">
      {children}
    </button>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm">{children}</div>;
}

const SOURCES: { id: StreetSource; label: string }[] = [
  { id: "mapillary", label: "Mapillary" },
  { id: "google", label: "Google" },
];

export function StreetViewPanel({
  target,
  subject,
  view,
  picked,
  variant,
  expanded,
  onToggleExpand,
  onClose,
  onWalk,
}: PanelProps) {
  const { mapillary, google } = view;
  // Without Mapillary, Google is the only source.
  const source: StreetSource | null = streetViewEnabled ? (picked ? "mapillary" : view.source) : "google";

  const photo = picked ?? (mapillary.lookup?.status === "found" ? mapillary.lookup.image : null);
  const pano = google.lookup?.status === "found" ? google.lookup.pano : null;

  let meta = "";
  if (source === "mapillary" && photo) {
    const away = distanceMeters(photo.position, target);
    const where = picked || away <= NEAR_M ? `${distance(away)} from ${subject}` : `Nearest photo · ${distance(away)} from ${subject}`;
    meta = [where, captureMonth(photo.capturedAt), photo.creator && `© ${photo.creator}`].filter(Boolean).join(" · ");
  } else if (source === "google" && pano) {
    meta = [`${distance(distanceMeters(pano.position, target))} from ${subject}`, googleMonth(pano.date)].filter(Boolean).join(" · ");
  }
  const external =
    source === "mapillary" && photo ? mapillaryUrl(photo) : googleStreetViewUrl(target, source === "google" ? pano : null);

  const switchTo = (next: StreetSource, label: string) => (
    <button type="button" className="btn btn-sm mt-3" onClick={() => view.setSource(next)}>
      {label}
    </button>
  );

  function body() {
    if (!source) return <Spinner label="Finding street imagery" />;

    if (source === "mapillary") {
      if (photo) return <MapillaryViewer imageId={photo.id} onMove={onWalk} />;
      if (!mapillary.lookup || mapillary.loading) return <Spinner label="Finding street photos" />;
      return (
        <Message>
          <div className="max-w-xs opacity-90">
            <p>
              {mapillary.lookup.status === "none"
                ? `No Mapillary photos within ${distance(SEARCH_STEPS_M[SEARCH_STEPS_M.length - 1])} of this spot yet.`
                : "Mapillary photos couldn’t load right now."}
            </p>
            {switchTo("google", "Try Google Street View")}
          </div>
        </Message>
      );
    }

    // Google
    if (!googleEmbedEnabled) {
      return (
        <Message>
          <div className="max-w-xs">
            <p className="opacity-90">Google Street View opens in Google Maps at this exact spot.</p>
            <a href={googleStreetViewUrl(target)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm mt-3 gap-1.5">
              Open Google Street View <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </Message>
      );
    }
    if (pano) {
      return (
        <iframe
          key={pano.id}
          src={googleEmbedUrl(pano)}
          title="Google Street View of this location"
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allow="fullscreen; accelerometer; gyroscope"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      );
    }
    if (!google.lookup || google.loading) return <Spinner label="Finding Google Street View" />;
    return (
      <Message>
        <div className="max-w-xs opacity-90">
          <p>
            {google.lookup.status === "none"
              ? `No Google Street View within ${GOOGLE_RADIUS_M} m of this spot.`
              : "Google Street View couldn’t load right now."}
          </p>
          {streetViewEnabled && photo && switchTo("mapillary", "See the Mapillary photo")}
        </div>
      </Message>
    );
  }

  return (
    <section
      aria-label="Street View"
      className={cn(
        "flex flex-col overflow-hidden rounded-box bg-neutral text-neutral-content shadow-[0_12px_40px_-12px_rgb(0_0_0/0.55)]",
        variant === "inline" && "h-72",
        variant === "overlay" &&
          (expanded
            ? "absolute inset-2 z-[1001]"
            : // Kept clear of the zoom buttons above and, on wide maps, of the centre where pins sit.
              "absolute inset-x-2 bottom-7 z-[1001] h-[56%] @xl:inset-x-auto @xl:left-3 @xl:h-auto @xl:max-h-[66%] @xl:aspect-[16/11] @xl:w-[min(46%,540px)]"),
      )}
    >
      <header className="flex items-center gap-2 px-2.5 pt-1.5 text-xs">
        <PersonStanding className="size-4 shrink-0 text-accent" aria-hidden />
        {streetViewEnabled ? (
          <div role="tablist" aria-label="Street imagery source" className="flex rounded-field bg-black/25 p-0.5">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={source === s.id}
                onClick={() => view.setSource(s.id)}
                className={cn(
                  "rounded-[calc(var(--radius-field)-2px)] px-2 py-0.5 font-medium transition-colors",
                  source === s.id ? "bg-neutral-content text-neutral" : "opacity-75 hover:opacity-100",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="font-semibold">Google Street View</span>
        )}
        <span className="flex-1" />
        {((source === "mapillary" && mapillary.loading && !picked) || (source === "google" && google.loading)) && (
          <span className="loading loading-spinner loading-xs opacity-70" aria-label="Loading" />
        )}
        {onToggleExpand && (
          <IconButton label={expanded ? "Shrink Street View" : "Expand Street View"} onClick={onToggleExpand}>
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </IconButton>
        )}
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-xs btn-square text-current"
          aria-label={source === "mapillary" && photo ? "Open in Mapillary" : "Open in Google Maps"}
          title={source === "mapillary" && photo ? "Open in Mapillary" : "Open in Google Maps"}
        >
          <ExternalLink className="size-3.5" />
        </a>
        {onClose && (
          <IconButton label="Hide Street View" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        )}
      </header>
      {/* Kept outside the viewer so it never covers Google's or Mapillary's own attribution. */}
      <p className="h-5 truncate px-3 text-[11px] leading-5 opacity-70" title={meta}>
        {meta}
      </p>

      <div className="relative min-h-0 flex-1 bg-black">{body()}</div>
    </section>
  );
}

/** Self-contained Street View for a fixed point, e.g. an incident in the responder console. */
export function InlineStreetView({ target, subject }: { target: LatLng; subject: StreetViewSubject }) {
  const view = useStreetView(target);
  return <StreetViewPanel target={target} subject={subject} view={view} variant="inline" />;
}
