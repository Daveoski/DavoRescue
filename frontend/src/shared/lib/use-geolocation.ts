"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type Fix = { lat: number; lng: number; accuracy: number; at: number };

type State =
  | { status: "locating"; fix: Fix | null; error: null }
  | { status: "ready"; fix: Fix; error: null }
  | { status: "error"; fix: Fix | null; error: string };

const messages: Record<number, string> = {
  1: "Location permission is blocked. Allow it in your browser settings, or drop the pin on the map.",
  2: "Your phone couldn't get a GPS fix. Move into the open, or drop the pin on the map.",
  3: "Getting your location is taking too long. Drop the pin on the map instead.",
};

const noopSubscribe = () => () => {};

/**
 * Watches the device position and keeps the most accurate recent fix.
 * GPS fixes improve over the first few seconds, so a single getCurrentPosition
 * often returns a cell-tower guess hundreds of metres off.
 */
export function useGeolocation(enabled = true) {
  const supported = useSyncExternalStore(noopSubscribe, () => "geolocation" in navigator, () => true);
  const [state, setState] = useState<State>({ status: "locating", fix: null, error: null });
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const watch = useCallback(() => {
    stop();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp };
        setState((s) => {
          const prev = s.fix;
          // Keep the previous fix if the new one is much worse and recent.
          const keep = prev && next.accuracy > prev.accuracy * 1.5 && next.at - prev.at < 20_000;
          return { status: "ready", fix: keep ? prev : next, error: null };
        });
        if (pos.coords.accuracy <= 15) stop();
      },
      (err) => setState((s) => ({ status: "error", fix: s.fix, error: messages[err.code] ?? err.message })),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [stop]);

  const retry = useCallback(() => {
    if (!supported) return;
    setState((s) => ({ status: "locating", fix: s.fix, error: null }));
    watch();
  }, [supported, watch]);

  useEffect(() => {
    if (enabled && supported) watch();
    return stop;
  }, [enabled, supported, watch, stop]);

  if (!supported) {
    return { status: "error" as const, fix: null, error: "This device can't share its location. Drop the pin on the map.", retry, stop };
  }
  return { ...state, retry, stop };
}
