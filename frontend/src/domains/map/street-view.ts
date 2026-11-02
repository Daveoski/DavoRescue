import { bearing, distanceMeters, type LatLng } from "@/shared/lib/geo";

/** Leaflet zoom at which the map is showing individual streets. */
export const STREET_VIEW_ZOOM = 17;
/** How far from the target we accept a panorama, in metres. */
export const SEARCH_RADIUS_M = 120;

// A browser key restricted to this site's referrers, with the Maps Embed API
// and Street View Static API enabled. Without it we link out to Google Maps.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export const streetViewEmbedEnabled = KEY.length > 0;

export type Panorama = {
  id: string;
  position: LatLng;
  /** "2022-03" style capture month, when Google provides it. */
  date: string | null;
  distance: number;
  heading: number | null;
};

export type PanoramaLookup =
  | { status: "found"; pano: Panorama }
  | { status: "none" }
  | { status: "error"; message: string };

/** Find the outdoor panorama nearest to `target`. Metadata lookups are free and don't use quota. */
export async function findPanorama(target: LatLng, signal?: AbortSignal): Promise<PanoramaLookup> {
  const params = new URLSearchParams({
    location: `${target.lat.toFixed(6)},${target.lng.toFixed(6)}`,
    radius: String(SEARCH_RADIUS_M),
    source: "outdoor",
    key: KEY,
  });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params}`, { signal });
    const data = await res.json();
    if (data.status === "OK") {
      const position = { lat: data.location.lat, lng: data.location.lng };
      const distance = distanceMeters(position, target);
      return {
        status: "found",
        pano: {
          id: data.pano_id,
          position,
          date: data.date ?? null,
          distance,
          // Turn the camera towards the incident unless we're standing on it.
          heading: distance > 4 ? bearing(position, target) : null,
        },
      };
    }
    if (data.status === "ZERO_RESULTS" || data.status === "NOT_FOUND") return { status: "none" };
    return { status: "error", message: data.error_message ?? data.status };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { status: "error", message: "Street View couldn't be reached" };
  }
}

export function embedUrl(pano: Panorama): string {
  const params = new URLSearchParams({ key: KEY, pano: pano.id, pitch: "0", fov: "80", language: "en" });
  if (pano.heading !== null) params.set("heading", pano.heading.toFixed(0));
  return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}

/** Google Maps' public URL scheme: opens Street View in the Maps app or site, no key needed. */
export function googleMapsPanoUrl(target: LatLng, pano?: Panorama | null): string {
  const viewpoint = pano?.position ?? target;
  const params = new URLSearchParams({ api: "1", map_action: "pano", viewpoint: `${viewpoint.lat},${viewpoint.lng}` });
  if (pano?.heading != null) params.set("heading", pano.heading.toFixed(0));
  return `https://www.google.com/maps/@?${params}`;
}

export function captureMonth(date: string | null): string | null {
  if (!date) return null;
  const [year, month] = date.split("-").map(Number);
  if (!year) return null;
  return month
    ? new Date(year, month - 1).toLocaleDateString("en-NG", { month: "short", year: "numeric" })
    : String(year);
}
