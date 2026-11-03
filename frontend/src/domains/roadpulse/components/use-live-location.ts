"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { tripsApi } from "../api";
import type { Trip } from "../types";

export type LiveStatus = "starting" | "live" | "searching" | "blocked" | "unsupported";

const SEND_EVERY_MS = 20_000;
const STALE_FIX_MS = 2 * 60_000;

const noopSubscribe = () => () => {};

/**
 * Streams the phone's position to an active trip so the people following the
 * link see it move. Sends at most every 20 s, and re-sends the latest fix on
 * that beat while standing still so "last seen" stays current.
 */
export function useLiveLocation(tripId: string | null, onTrip: (t: Trip) => void): LiveStatus {
  const supported = useSyncExternalStore(noopSubscribe, () => "geolocation" in navigator, () => true);
  const [status, setStatus] = useState<LiveStatus>("starting");
  const latest = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const onTripRef = useRef(onTrip);
  useEffect(() => {
    onTripRef.current = onTrip;
  });

  useEffect(() => {
    if (!tripId || !supported) return;
    let lastSent = 0;

    const send = () => {
      const fix = latest.current;
      // Don't re-stamp a position the phone hasn't confirmed for a while.
      if (!fix || Date.now() - fix.at > STALE_FIX_MS) return;
      lastSent = Date.now();
      tripsApi.ping(tripId, fix.lat, fix.lng).then((t) => onTripRef.current(t), () => undefined);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
        setStatus("live");
        if (Date.now() - lastSent >= SEND_EVERY_MS) send();
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "blocked" : "searching"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    const beat = setInterval(() => {
      if (Date.now() - lastSent >= SEND_EVERY_MS) send();
    }, SEND_EVERY_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(beat);
    };
  }, [tripId, supported]);

  return supported ? status : "unsupported";
}
