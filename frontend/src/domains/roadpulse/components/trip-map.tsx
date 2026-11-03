"use client";

import { useEffect } from "react";
import { CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";

import BaseMap from "@/domains/map/components/base-map";

type Point = { lat: number; lng: number };

/** Keeps the traveller in view as new positions arrive. */
function Follow({ lat, lng }: Point) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng], { animate: true });
  }, [map, lat, lng]);
  return null;
}

export default function TripMap({ position, trail = [], label = "Last position" }: { position: Point; trail?: Point[]; label?: string }) {
  return (
    <BaseMap center={[position.lat, position.lng]} zoom={14} streetViewTarget={position}>
      <Follow lat={position.lat} lng={position.lng} />
      {trail.length > 1 && (
        <Polyline positions={trail.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#2a66cf", weight: 4, opacity: 0.55, dashArray: "6 8" }} />
      )}
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={9}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2a66cf", fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          {label}
        </Tooltip>
      </CircleMarker>
    </BaseMap>
  );
}
