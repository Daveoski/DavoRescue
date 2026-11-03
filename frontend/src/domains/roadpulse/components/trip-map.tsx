"use client";

import { CircleMarker, Tooltip } from "react-leaflet";

import BaseMap from "@/domains/map/components/base-map";

export default function TripMap({ position }: { position: { lat: number; lng: number } }) {
  return (
    <BaseMap center={[position.lat, position.lng]} zoom={14} streetViewTarget={position}>
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={9}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2a66cf", fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]}>
          Last position
        </Tooltip>
      </CircleMarker>
    </BaseMap>
  );
}
