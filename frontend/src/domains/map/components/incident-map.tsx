"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";

import { categoryMeta } from "@/domains/incidents/catalogue";
import type { PublicIncident } from "@/domains/incidents/types";
import { timeAgo, titleCase } from "@/shared/lib/format";

import BaseMap from "./base-map";

type Props = {
  incidents: PublicIncident[];
  center: [number, number];
  zoom?: number;
  focus?: { lat: number; lng: number } | null;
  me?: { lat: number; lng: number } | null;
  selected?: string | null;
  onSelect?: (ref: string) => void;
};

function FlyTo({ target }: { target: { lat: number; lng: number } | null | undefined }) {
  const map = useMap();
  const lat = target?.lat;
  const lng = target?.lng;
  // Keyed on the coordinates, not the object, so polling refreshes don't yank the map back.
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

export default function IncidentMap({ incidents, center, zoom = 11, focus, me, selected, onSelect }: Props) {
  // Draw older and calmer incidents first so severe, recent ones sit on top.
  const ordered = useMemo(
    () => [...incidents].sort((a, b) => (a.severity ?? 0) - (b.severity ?? 0) || a.created_at.localeCompare(b.created_at)),
    [incidents],
  );

  const selectedIncident = incidents.find((i) => i.ref === selected);

  return (
    <BaseMap
      center={center}
      zoom={zoom}
      streetViewTarget={selectedIncident ? { lat: selectedIncident.lat, lng: selectedIncident.lng } : null}
    >
      <FlyTo target={focus} />
      {me && (
        <CircleMarker
          center={[me.lat, me.lng]}
          radius={7}
          pathOptions={{ color: "#fff", weight: 3, fillColor: "#2a66cf", fillOpacity: 1 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}
      {ordered.map((incident) => {
        const meta = categoryMeta[incident.category];
        const active = incident.status !== "resolved";
        const isSelected = selected === incident.ref;
        return (
          <CircleMarker
            key={incident.ref}
            center={[incident.lat, incident.lng]}
            radius={6 + (incident.severity ?? 2) * 2 + (isSelected ? 4 : 0)}
            pathOptions={{
              color: isSelected ? "#16181d" : "#ffffff",
              weight: isSelected ? 3 : 2,
              fillColor: active ? meta.color : "#8a8f98",
              fillOpacity: active ? 0.9 : 0.55,
            }}
            eventHandlers={{ click: () => onSelect?.(incident.ref) }}
          >
            <Popup>
              <div className="min-w-48">
                <p className="eyebrow">{meta.label} · {timeAgo(incident.created_at)}</p>
                <p className="mt-1 font-display text-base font-bold leading-tight">{titleCase(incident.subtype)}</p>
                <p className="mt-1 text-sm">{incident.road_name ?? incident.lga ?? "Exact location pinned"}</p>
                {incident.alert && <p className="mt-2 text-sm opacity-80">{incident.alert}</p>}
                <Link href={`/incidents/${incident.ref}`} className="link link-primary mt-2 inline-block text-sm font-medium">
                  Details &amp; directions
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </BaseMap>
  );
}
