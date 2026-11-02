"use client";

import { useEffect, useState } from "react";

import type { LatLng } from "@/shared/lib/geo";

import { findPanorama, streetViewEmbedEnabled, type PanoramaLookup } from "./street-view";

/**
 * Nearest Street View panorama for `target`, re-queried (debounced) as the
 * target moves. Pass null to pause lookups. Keeps the previous result while
 * a new lookup is in flight so the view doesn't flash empty during a pan.
 */
export function usePanorama(target: LatLng | null) {
  const key = target && streetViewEmbedEnabled ? `${target.lat.toFixed(5)},${target.lng.toFixed(5)}` : null;
  const [result, setResult] = useState<{ key: string; lookup: PanoramaLookup } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const [lat, lng] = key.split(",").map(Number);
    const timer = setTimeout(() => {
      findPanorama({ lat, lng }, controller.signal)
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
