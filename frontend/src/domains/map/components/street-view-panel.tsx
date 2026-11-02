"use client";

import { ExternalLink, Maximize2, Minimize2, PersonStanding, X } from "lucide-react";
import dynamic from "next/dynamic";

import { cn } from "@/shared/lib/cn";
import { distance } from "@/shared/lib/format";
import type { LatLng } from "@/shared/lib/geo";

import {
  captureMonth,
  googleStreetViewUrl,
  mapillaryUrl,
  SEARCH_RADIUS_M,
  streetViewEnabled,
  type StreetImageLookup,
} from "../street-view";
import { useStreetImage } from "../use-street-image";

// WebGL viewer: browser-only, and its ~1 MB bundle loads only when Street View opens.
const MapillaryViewer = dynamic(() => import("./mapillary-viewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center">
      <span className="loading loading-dots loading-md opacity-60" />
    </div>
  ),
});

type PanelProps = {
  target: LatLng;
  lookup: StreetImageLookup | null;
  loading: boolean;
  variant: "overlay" | "inline";
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
  onWalk?: (image: { id: string; position: LatLng }) => void;
};

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="btn btn-ghost btn-xs btn-square text-current">
      {children}
    </button>
  );
}

function GoogleFallback({ target, text }: { target: LatLng; text: string }) {
  return (
    <p className="max-w-xs opacity-85">
      {text}{" "}
      <a href={googleStreetViewUrl(target)} target="_blank" rel="noopener noreferrer" className="link font-medium">
        Try Google Street View
      </a>
      .
    </p>
  );
}

export function StreetViewPanel({ target, lookup, loading, variant, expanded, onToggleExpand, onClose, onWalk }: PanelProps) {
  // Without a Mapillary token, offer Google's Street View instead of an empty frame.
  if (!streetViewEnabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 text-base-content shadow-lg",
          variant === "overlay" && "absolute bottom-7 left-2 right-2 z-[1001] @xl:right-auto @xl:max-w-sm",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-content">
          <PersonStanding className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm leading-tight">
          <span className="block font-semibold">Street View</span>
          <span className="text-base-content/65">See this spot at street level</span>
        </span>
        <a href={googleStreetViewUrl(target)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm gap-1">
          Open <ExternalLink className="size-3.5" aria-hidden />
        </a>
        {onClose && (
          <IconButton label="Hide Street View" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        )}
      </div>
    );
  }

  const image = lookup?.status === "found" ? lookup.image : null;
  const meta = image
    ? [`${captureMonth(image.capturedAt)}`, `${distance(image.distance)} from ${variant === "inline" ? "incident" : "pin"}`]
        .concat(image.creator ? [`© ${image.creator}`] : [])
        .join(" · ")
    : "";

  return (
    <section
      aria-label="Street View"
      className={cn(
        "flex flex-col overflow-hidden rounded-box bg-neutral text-neutral-content shadow-[0_12px_40px_-12px_rgb(0_0_0/0.55)]",
        variant === "inline" && "h-64",
        variant === "overlay" &&
          (expanded
            ? "absolute inset-2 z-[1001]"
            : // Kept clear of the zoom buttons above and, on wide maps, of the centre where pins sit.
              "absolute inset-x-2 bottom-7 z-[1001] h-[52%] @xl:inset-x-auto @xl:left-3 @xl:h-auto @xl:max-h-[62%] @xl:aspect-[16/10] @xl:w-[min(44%,520px)]"),
      )}
    >
      <header className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <PersonStanding className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="font-semibold">Street View</span>
        <span className="min-w-0 flex-1 truncate opacity-70" title={meta}>
          {meta}
        </span>
        {loading && <span className="loading loading-spinner loading-xs opacity-70" aria-label="Loading" />}
        {onToggleExpand && (
          <IconButton label={expanded ? "Shrink Street View" : "Expand Street View"} onClick={onToggleExpand}>
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </IconButton>
        )}
        <a
          href={image ? mapillaryUrl(image) : googleStreetViewUrl(target)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-xs btn-square text-current"
          aria-label={image ? "Open in Mapillary" : "Open Google Street View"}
          title={image ? "Open in Mapillary" : "Open Google Street View"}
        >
          <ExternalLink className="size-3.5" />
        </a>
        {onClose && (
          <IconButton label="Hide Street View" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        )}
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        {image ? (
          <MapillaryViewer imageId={image.id} onMove={onWalk} />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm">
            {!lookup || loading ? (
              <span className="loading loading-dots loading-md opacity-60" aria-label="Finding street photos" />
            ) : lookup.status === "none" ? (
              <GoogleFallback target={target} text={`No Mapillary street photos within ${SEARCH_RADIUS_M} m of this spot yet.`} />
            ) : (
              <GoogleFallback target={target} text="Street photos couldn’t load right now." />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Self-contained Street View for a fixed point, e.g. an incident in the responder console. */
export function InlineStreetView({ target }: { target: LatLng }) {
  const { lookup, loading } = useStreetImage(target);
  return <StreetViewPanel target={target} lookup={lookup} loading={loading} variant="inline" />;
}
