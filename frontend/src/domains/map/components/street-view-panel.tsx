"use client";

import { ExternalLink, Maximize2, Minimize2, PersonStanding, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { distance } from "@/shared/lib/format";
import type { LatLng } from "@/shared/lib/geo";

import { captureMonth, embedUrl, googleMapsPanoUrl, SEARCH_RADIUS_M, streetViewEmbedEnabled, type PanoramaLookup } from "../street-view";
import { usePanorama } from "../use-panorama";

type PanelProps = {
  target: LatLng;
  lookup: PanoramaLookup | null;
  loading: boolean;
  variant: "overlay" | "inline";
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
};

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="btn btn-ghost btn-xs btn-square text-current">
      {children}
    </button>
  );
}

export function StreetViewPanel({ target, lookup, loading, variant, expanded, onToggleExpand, onClose }: PanelProps) {
  const pano = lookup?.status === "found" ? lookup.pano : null;
  const external = googleMapsPanoUrl(target, pano);

  // Without an embed key, offer Google Maps' own Street View instead of an empty frame.
  if (!streetViewEmbedEnabled) {
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
        <a href={external} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm gap-1">
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

  const month = pano ? captureMonth(pano.date) : null;
  return (
    <section
      aria-label="Street View"
      className={cn(
        "flex flex-col overflow-hidden rounded-box bg-neutral text-neutral-content shadow-[0_12px_40px_-12px_rgb(0_0_0/0.55)]",
        variant === "inline" && "h-60",
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
        <span className="min-w-0 flex-1 truncate opacity-70">
          {pano ? [month && `Captured ${month}`, `${distance(pano.distance)} from ${variant === "inline" ? "incident" : "pin"}`].filter(Boolean).join(" · ") : ""}
        </span>
        {loading && <span className="loading loading-spinner loading-xs opacity-70" aria-label="Loading" />}
        {onToggleExpand && (
          <IconButton label={expanded ? "Shrink Street View" : "Expand Street View"} onClick={onToggleExpand}>
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </IconButton>
        )}
        <a href={external} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs btn-square text-current" aria-label="Open in Google Maps" title="Open in Google Maps">
          <ExternalLink className="size-3.5" />
        </a>
        {onClose && (
          <IconButton label="Hide Street View" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        )}
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        {pano ? (
          <iframe
            key={pano.id}
            src={embedUrl(pano)}
            title="Street View of this location"
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allow="fullscreen; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm">
            {!lookup || loading ? (
              <span className="loading loading-dots loading-md opacity-60" aria-label="Finding street imagery" />
            ) : lookup.status === "none" ? (
              <p className="max-w-xs opacity-80">
                No street-level imagery within {SEARCH_RADIUS_M} m of this spot — common on footpaths and bush tracks. Switch the map to
                Satellite to see the ground.
              </p>
            ) : (
              <p className="max-w-xs opacity-80">
                Street View isn&apos;t available right now.{" "}
                <a href={external} target="_blank" rel="noopener noreferrer" className="link">
                  Open it in Google Maps
                </a>
                .
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Self-contained Street View for a fixed point, e.g. an incident in the responder console. */
export function InlineStreetView({ target }: { target: LatLng }) {
  const { lookup, loading } = usePanorama(target);
  return <StreetViewPanel target={target} lookup={lookup} loading={loading} variant="inline" />;
}
