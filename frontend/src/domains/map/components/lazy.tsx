"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so maps only ever render in the browser.
function MapSkeleton() {
  return (
    <div className="grid-paper flex h-full w-full items-center justify-center bg-base-200" aria-busy="true">
      <span className="loading loading-dots loading-md text-base-content/40" />
    </div>
  );
}

export const IncidentMap = dynamic(() => import("./incident-map"), { ssr: false, loading: MapSkeleton });
export const LocationPicker = dynamic(() => import("./location-picker"), { ssr: false, loading: MapSkeleton });
