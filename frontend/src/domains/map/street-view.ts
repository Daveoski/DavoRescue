import { bearing, distanceMeters, type LatLng } from "@/shared/lib/geo";

/** Leaflet zoom at which the map is showing individual streets. */
export const STREET_VIEW_ZOOM = 17;
/** One level earlier, photo locations appear on the map so people can see where to zoom. */
export const COVERAGE_ZOOM = 16;
/**
 * Photos follow the roads volunteers have driven, so a spot between them can
 * have none close by. Widen the search until something useful turns up.
 */
export const SEARCH_STEPS_M = [150, 500, 1500] as const;
/** Beyond this the photo shows the area, not the spot itself. */
export const NEAR_M = SEARCH_STEPS_M[0];

// Mapillary client token (public by design; safe in the browser). Without it
// we link out to Google Street View instead.
export const MAPILLARY_TOKEN = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "";
export const streetViewEnabled = MAPILLARY_TOKEN.length > 0;

export type StreetImage = {
  id: string;
  position: LatLng;
  capturedAt: number;
  creator: string | null;
  isPano: boolean;
  compass: number | null;
};

export type StreetImageLookup =
  | { status: "found"; image: StreetImage }
  | { status: "none" }
  | { status: "error"; message: string };

export type Bounds = { south: number; west: number; north: number; east: number };

type GraphImage = {
  id: string;
  geometry: { coordinates: [number, number] };
  computed_geometry?: { coordinates: [number, number] };
  captured_at: number;
  compass_angle?: number;
  computed_compass_angle?: number;
  is_pano?: boolean;
  creator?: { username?: string };
};

const FIELDS = "id,geometry,computed_geometry,captured_at,compass_angle,computed_compass_angle,is_pano,creator";
const YEAR_MS = 365 * 24 * 3600 * 1000;

function toStreetImage(img: GraphImage): StreetImage {
  const [lng, lat] = (img.computed_geometry ?? img.geometry).coordinates;
  return {
    id: img.id,
    position: { lat, lng },
    capturedAt: img.captured_at,
    creator: img.creator?.username ?? null,
    isPano: Boolean(img.is_pano),
    compass: img.computed_compass_angle ?? img.compass_angle ?? null,
  };
}

async function searchImages(bounds: Bounds, limit: number, signal?: AbortSignal): Promise<GraphImage[]> {
  const params = new URLSearchParams({
    access_token: MAPILLARY_TOKEN,
    fields: FIELDS,
    bbox: [bounds.west, bounds.south, bounds.east, bounds.north].map((v) => v.toFixed(6)).join(","),
    limit: String(limit),
  });
  const res = await fetch(`https://graph.mapillary.com/images?${params}`, { signal });
  if (!res.ok) throw new Error(`Mapillary returned ${res.status}`);
  return ((await res.json()) as { data: GraphImage[] }).data;
}

function boundsAround(target: LatLng, radius: number): Bounds {
  const dLat = radius / 111_320;
  const dLng = radius / (111_320 * Math.cos((target.lat * Math.PI) / 180));
  return { south: target.lat - dLat, north: target.lat + dLat, west: target.lng - dLng, east: target.lng + dLng };
}

/**
 * Rank candidates so the chosen photo is close, recent and — for ordinary
 * (non-360°) photos — actually pointing at the target rather than away from it.
 */
function rank(image: StreetImage, target: LatLng, now: number): number {
  const distance = distanceMeters(image.position, target);
  let facingPenalty = 0;
  if (!image.isPano && image.compass !== null && distance > 8) {
    const off = Math.abs(((bearing(image.position, target) - image.compass + 540) % 360) - 180);
    facingPenalty = (off / 180) * 90;
  }
  const agePenalty = Math.min(10, (now - image.capturedAt) / YEAR_MS) * 4;
  return distance + facingPenalty + agePenalty;
}

export async function findStreetImage(target: LatLng, signal?: AbortSignal): Promise<StreetImageLookup> {
  try {
    for (const radius of SEARCH_STEPS_M) {
      const now = Date.now();
      const best = (await searchImages(boundsAround(target, radius), radius === NEAR_M ? 200 : 500, signal))
        .map(toStreetImage)
        .filter((image) => distanceMeters(image.position, target) <= radius)
        .sort((a, b) => rank(a, target, now) - rank(b, target, now))[0];
      if (best) return { status: "found", image: best };
    }
    return { status: "none" };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { status: "error", message: "Mapillary couldn't be reached" };
  }
}

/** Every photo point in view, so people can see where street photos exist and pick one. */
export async function fetchCoverage(bounds: Bounds, signal?: AbortSignal): Promise<StreetImage[]> {
  return (await searchImages(bounds, 500, signal)).map(toStreetImage);
}

/* ------------------------------------------------------------------ */
/* Google Street View                                                  */
/* ------------------------------------------------------------------ */

// Browser key restricted to this site, with the Maps Embed API and Street View
// Static API enabled. Both uses are free; without a key the Google tab links out.
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const googleEmbedEnabled = GOOGLE_KEY.length > 0;
export const GOOGLE_RADIUS_M = 120;

export type GooglePano = {
  id: string;
  position: LatLng;
  /** "2023-04" style capture month, when Google provides it. */
  date: string | null;
  /** Camera heading that faces the target. */
  heading: number | null;
};

export type GooglePanoLookup =
  | { status: "found"; pano: GooglePano }
  | { status: "none" }
  | { status: "error"; message: string };

/** Nearest outdoor Google panorama. Metadata lookups are free and use no quota. */
export async function findGooglePano(target: LatLng, signal?: AbortSignal): Promise<GooglePanoLookup> {
  const params = new URLSearchParams({
    location: `${target.lat.toFixed(6)},${target.lng.toFixed(6)}`,
    radius: String(GOOGLE_RADIUS_M),
    source: "outdoor",
    key: GOOGLE_KEY,
  });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params}`, { signal });
    const data = await res.json();
    if (data.status === "OK") {
      const position = { lat: data.location.lat, lng: data.location.lng };
      return {
        status: "found",
        pano: {
          id: data.pano_id,
          position,
          date: data.date ?? null,
          heading: distanceMeters(position, target) > 4 ? bearing(position, target) : null,
        },
      };
    }
    if (data.status === "ZERO_RESULTS" || data.status === "NOT_FOUND") return { status: "none" };
    return { status: "error", message: data.error_message ?? data.status };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { status: "error", message: "Google Street View couldn't be reached" };
  }
}

export function googleEmbedUrl(pano: GooglePano): string {
  const params = new URLSearchParams({ key: GOOGLE_KEY, pano: pano.id, pitch: "0", fov: "80", language: "en" });
  if (pano.heading !== null) params.set("heading", pano.heading.toFixed(0));
  return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}

export function googleMonth(date: string | null): string | null {
  if (!date) return null;
  const [year, month] = date.split("-").map(Number);
  if (!year) return null;
  return month ? new Date(year, month - 1).toLocaleDateString("en-NG", { month: "short", year: "numeric" }) : String(year);
}

/** Google Maps' public URL scheme: opens Street View in the Maps app or site, no key needed. */
export function googleStreetViewUrl(target: LatLng, pano?: GooglePano | null): string {
  const viewpoint = pano?.position ?? target;
  const params = new URLSearchParams({ api: "1", map_action: "pano", viewpoint: `${viewpoint.lat},${viewpoint.lng}` });
  if (pano?.heading != null) params.set("heading", pano.heading.toFixed(0));
  return `https://www.google.com/maps/@?${params}`;
}

export function mapillaryUrl(image: StreetImage): string {
  return `https://www.mapillary.com/app/?pKey=${image.id}&focus=photo`;
}

export function captureMonth(ms: number): string {
  return new Date(ms).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}
