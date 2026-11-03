"use client";

import { useEffect, useState } from "react";

import { distanceMeters, type LatLng } from "@/shared/lib/geo";

import {
  fetchCoverage,
  findGooglePano,
  findStreetImage,
  googleEmbedEnabled,
  NEAR_M,
  streetViewEnabled,
  type Bounds,
  type GooglePanoLookup,
  type StreetImage,
  type StreetImageLookup,
} from "./street-view";

export type StreetSource = "mapillary" | "google";

const keyOf = (target: LatLng) => `${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;

/**
 * Runs `lookup` for `key` (debounced, abortable) and remembers the answer for that key.
 * Pass module-level `lookup` functions so the effect only re-runs when the key changes.
 */
function useKeyedLookup<T>(key: string | null, lookup: (key: string, signal: AbortSignal) => Promise<T>, delay = 400) {
  const [result, setResult] = useState<{ key: string; value: T } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      lookup(key, controller.signal)
        .then((value) => setResult({ key, value }))
        .catch(() => undefined);
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, lookup, delay]);

  // Keep the previous answer while a new one loads so the view doesn't flash empty during a pan.
  return { value: result?.value ?? null, loading: key !== null && result?.key !== key };
}

const parse = (key: string): LatLng => {
  const [lat, lng] = key.split(",").map(Number);
  return { lat, lng };
};
const mapillaryLookup = (key: string, signal: AbortSignal) => findStreetImage(parse(key), signal);
const googleLookup = (key: string, signal: AbortSignal) => findGooglePano(parse(key), signal);
const coverageLookup = (key: string, signal: AbortSignal) => {
  const [south, west, north, east] = key.split(",").map(Number);
  return fetchCoverage({ south, west, north, east }, signal);
};

/** Best Mapillary photo for `target`. Pass null to pause. */
export function useStreetImage(target: LatLng | null) {
  const { value, loading } = useKeyedLookup<StreetImageLookup>(target && streetViewEnabled ? keyOf(target) : null, mapillaryLookup);
  return { lookup: value, loading };
}

/** Nearest Google panorama for `target` (only when a Google key is configured). */
export function useGooglePano(target: LatLng | null) {
  const { value, loading } = useKeyedLookup<GooglePanoLookup>(target && googleEmbedEnabled ? keyOf(target) : null, googleLookup);
  return { lookup: value, loading };
}

/** Street photo points inside `bounds` (debounced). Pass null to clear. */
export function useStreetCoverage(bounds: Bounds | null): StreetImage[] {
  const key =
    bounds && streetViewEnabled ? [bounds.south, bounds.west, bounds.north, bounds.east].map((v) => v.toFixed(4)).join(",") : null;
  const { value } = useKeyedLookup<StreetImage[]>(key, coverageLookup, 500);
  return key ? (value ?? []) : [];
}

/**
 * Prefer whichever source has imagery of the spot itself: a Mapillary photo
 * close by, else a Google panorama, else the nearest Mapillary photo further out.
 */
function autoSource(target: LatLng, mapillary: StreetImageLookup | null, google: GooglePanoLookup | null): StreetSource {
  const photo = mapillary?.status === "found" ? mapillary.image : null;
  if (photo && distanceMeters(photo.position, target) <= NEAR_M) return "mapillary";
  if (google?.status === "found") return "google";
  if (photo) return "mapillary";
  return googleEmbedEnabled ? "google" : "mapillary";
}

/**
 * Both street-level sources for one target, plus which one to show. The
 * automatic choice waits for both lookups so the panel doesn't flip between
 * them; once the user picks a source, that choice sticks.
 */
export function useStreetView(target: LatLng | null) {
  const mapillary = useStreetImage(target);
  const google = useGooglePano(target);
  const [chosen, setChosen] = useState<StreetSource | null>(null);

  const settled = !mapillary.loading && !google.loading;
  const source: StreetSource | null =
    chosen ?? (target && settled ? autoSource(target, mapillary.lookup, google.lookup) : null);

  return { source, setSource: setChosen, mapillary, google };
}
