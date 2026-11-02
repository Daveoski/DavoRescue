"use client";

import { useEffect, useState } from "react";

import type { LatLng } from "@/shared/lib/geo";

import { fetchCoverage, findStreetImage, streetViewEnabled, type Bounds, type StreetImage, type StreetImageLookup } from "./street-view";

/**
 * Best street-level photo for `target`, re-queried (debounced) as the target
 * moves. Pass null to pause lookups. Keeps the previous result while a new
 * lookup is in flight so the view doesn't flash empty during a pan.
 */
export function useStreetImage(target: LatLng | null) {
  const key = target && streetViewEnabled ? `${target.lat.toFixed(5)},${target.lng.toFixed(5)}` : null;
  const [result, setResult] = useState<{ key: string; lookup: StreetImageLookup } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const [lat, lng] = key.split(",").map(Number);
    const timer = setTimeout(() => {
      findStreetImage({ lat, lng }, controller.signal)
        .then((lookup) => setResult({ key, lookup }))
        .catch(() => undefined);
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return { lookup: result?.lookup ?? null, loading: key !== null && result?.key !== key };
}

/** Street photo points inside `bounds` (debounced). Pass null to clear. */
export function useStreetCoverage(bounds: Bounds | null): StreetImage[] {
  const key =
    bounds && streetViewEnabled ? [bounds.south, bounds.west, bounds.north, bounds.east].map((v) => v.toFixed(4)).join(",") : null;
  const [result, setResult] = useState<{ key: string; images: StreetImage[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const [south, west, north, east] = key.split(",").map(Number);
    const timer = setTimeout(() => {
      fetchCoverage({ south, west, north, east }, controller.signal)
        .then((images) => setResult({ key, images }))
        .catch(() => undefined);
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return key ? (result?.images ?? []) : [];
}
