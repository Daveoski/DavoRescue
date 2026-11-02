"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, Marker, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";

import type { RoadContext } from "@/domains/incidents/types";

import BaseMap from "./base-map";

type Props = {
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
  road: RoadContext | null;
  fallbackCenter: [number, number];
  onMove: (lat: number, lng: number) => void;
  onZoomChange?: (zoom: number) => void;
};

const pinIcon = L.divIcon({
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 43s14-14.6 14-25.5C31 8.9 24.7 2 17 2S3 8.9 3 17.5C3 28.4 17 43 17 43z" fill="#d63a1f" stroke="#fff" stroke-width="2.5"/>
    <circle cx="17" cy="17" r="5.5" fill="#fff"/></svg>`,
});

// One level above Street View, so the reporter sees the surrounding roads first
// and Street View opens only when they zoom in themselves.
const PIN_ZOOM = 16;

function Recenter({ position }: { position: Props["position"] }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), PIN_ZOOM), { animate: true });
    // Only recenter when the fix itself changes, not on every drag.
  }, [map, position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function TapToPlace({ onMove }: { onMove: Props["onMove"] }) {
  useMapEvents({ click: (e) => onMove(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LocationPicker({ position, accuracy, road, fallbackCenter, onMove, onZoomChange }: Props) {
  const handlers = useMemo(
    () => ({
      dragend: (e: L.DragEndEvent) => {
        const { lat, lng } = (e.target as L.Marker).getLatLng();
        onMove(lat, lng);
      },
    }),
    [onMove],
  );

  const access = road?.navigability !== "navigable" ? road?.access : null;

  return (
    <BaseMap
      center={position ? [position.lat, position.lng] : fallbackCenter}
      zoom={position ? PIN_ZOOM : 12}
      defaultLayer={road?.navigability === "off_network" ? "satellite" : "streets"}
      // The report form shows Street View below this small map so it never hides the pin.
      streetView="off"
      onViewChange={onZoomChange ? (view) => onZoomChange(view.zoom) : undefined}
    >
      <Recenter position={position} />
      <TapToPlace onMove={onMove} />
      {position && accuracy && accuracy < 500 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracy}
          pathOptions={{ color: "#2a66cf", weight: 1, fillOpacity: 0.08 }}
        />
      )}
      {position && access && (
        <>
          <Polyline
            positions={[[position.lat, position.lng], [access.lat, access.lng]]}
            pathOptions={{ color: "#16181d", weight: 2, dashArray: "6 6" }}
          />
          <CircleMarker
            center={[access.lat, access.lng]}
            radius={7}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#15805a", fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} permanent>
              Vehicle access
            </Tooltip>
          </CircleMarker>
        </>
      )}
      {position && (
        <Marker position={[position.lat, position.lng]} draggable icon={pinIcon} eventHandlers={handlers} />
      )}
    </BaseMap>
  );
}
