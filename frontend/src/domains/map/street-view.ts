import { bearing, distanceMeters, type LatLng } from "@/shared/lib/geo";

/** Leaflet zoom at which the map is showing individual streets. */
export const STREET_VIEW_ZOOM = 17;
/** How far from the target we accept a photo, in metres. */
export const SEARCH_RADIUS_M = 150;

// Mapillary client token (public by design; safe in the browser). Without it
// we link out to Google Street View instead.
export const MAPILLARY_TOKEN = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "";
export const streetViewEnabled = MAPILLARY_TOKEN.length > 0;

export type StreetImage = {
  id: string;
  position: LatLng;
  capturedAt: number;
  distance: number;
  creator: string | null;
  isPano: boolean;
};

export type StreetImageLookup =
  | { status: "found"; image: StreetImage }
  | { status: "none" }
  | { status: "error"; message: string };

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

const YEAR_MS = 365 * 24 * 3600 * 1000;

/**
 * Rank candidates so the chosen photo is close, recent and — for ordinary
 * (non-360°) photos — actually pointing at the target rather than away from it.
 */
function score(img: GraphImage, target: LatLng, now: number) {
  const [lng, lat] = (img.computed_geometry ?? img.geometry).coordinates;
  const position = { lat, lng };
  const distance = distanceMeters(position, target);
  const compass = img.computed_compass_angle ?? img.compass_angle;
  let facingPenalty = 0;
  if (!img.is_pano && compass !== undefined && distance > 8) {
    const off = Math.abs(((bearing(position, target) - compass + 540) % 360) - 180);
    facingPenalty = (off / 180) * 90;
  }
  const agePenalty = Math.min(10, (now - img.captured_at) / YEAR_MS) * 4;
  return { position, distance, rank: distance + facingPenalty + agePenalty };
}

export async function findStreetImage(target: LatLng, signal?: AbortSignal): Promise<StreetImageLookup> {
  const dLat = SEARCH_RADIUS_M / 111_320;
  const dLng = SEARCH_RADIUS_M / (111_320 * Math.cos((target.lat * Math.PI) / 180));
  const bbox = [target.lng - dLng, target.lat - dLat, target.lng + dLng, target.lat + dLat].map((v) => v.toFixed(6)).join(",");
  const params = new URLSearchParams({
    access_token: MAPILLARY_TOKEN,
    fields: "id,geometry,computed_geometry,captured_at,compass_angle,computed_compass_angle,is_pano,creator",
    bbox,
    limit: "100",
  });

  try {
    const res = await fetch(`https://graph.mapillary.com/images?${params}`, { signal });
    if (!res.ok) return { status: "error", message: `Mapillary returned ${res.status}` };
    const { data } = (await res.json()) as { data: GraphImage[] };
    const now = Date.now();
    const best = data
      .map((img) => ({ img, ...score(img, target, now) }))
      .filter((c) => c.distance <= SEARCH_RADIUS_M)
      .sort((a, b) => a.rank - b.rank)[0];
    if (!best) return { status: "none" };
    return {
      status: "found",
      image: {
        id: best.img.id,
        position: best.position,
        capturedAt: best.img.captured_at,
        distance: best.distance,
        creator: best.img.creator?.username ?? null,
        isPano: Boolean(best.img.is_pano),
      },
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { status: "error", message: "Mapillary couldn't be reached" };
  }
}

/** Google Maps' public URL scheme: opens Street View in the Maps app or site, no key needed. */
export function googleStreetViewUrl(target: LatLng): string {
  const params = new URLSearchParams({ api: "1", map_action: "pano", viewpoint: `${target.lat},${target.lng}` });
  return `https://www.google.com/maps/@?${params}`;
}

export function mapillaryUrl(image: StreetImage): string {
  return `https://www.mapillary.com/app/?pKey=${image.id}&focus=photo`;
}

export function captureMonth(ms: number): string {
  return new Date(ms).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}
