"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";

import BaseMap from "@/domains/map/components/base-map";
import { signLabel, statusMeta } from "@/domains/roadpulse/catalogue";
import type { WarningCluster } from "@/domains/roadpulse/types";

import { displayLevel } from "../api";
import type { Corridor, Stretch } from "../types";

type Props = {
  corridors: Corridor[];
  warnings: WarningCluster[];
  selected: Stretch | null;
  onSelect: (corridor: Corridor, stretch: Stretch) => void;
};

function warningIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [30, 28],
    iconAnchor: [15, 26],
    html: `<svg width="30" height="28" viewBox="0 0 30 28" aria-hidden="true"><path d="M15 2 28.5 26h-27z" fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M15 10v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="15" cy="21" r="1.6" fill="#fff"/></svg>`,
  });
}

function FitTo({ selected, all }: { selected: Stretch | null; all: [number, number][] }) {
  const map = useMap();
  const target = selected?.id ?? "all";
  useEffect(() => {
    const points = selected ? selected.path : all;
    if (points.length) map.flyToBounds(L.latLngBounds(points), { padding: [40, 40], duration: 0.8, maxZoom: 15 });
    // Re-fit only when the selection changes, not on every data refresh.
  }, [map, target]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function RoadWatchMap({ corridors, warnings, selected, onSelect }: Props) {
  const all = useMemo(() => corridors.flatMap((c) => c.segments.flatMap((s) => s.path)), [corridors]);
  const icons = useMemo(
    () => ({ corroborated: warningIcon(statusMeta.corroborated.color), confirmed: warningIcon(statusMeta.confirmed.color) }),
    [],
  );
  // Zooming in on a selected stretch points Street View at its middle.
  const mid = selected ? selected.path[Math.floor(selected.path.length / 2)] : null;

  const pick = (w: WarningCluster) => {
    for (const c of corridors) {
      const s = c.segments.find((x) => x.id === w.segment?.id);
      if (s) return onSelect(c, s);
    }
  };

  return (
    <BaseMap center={[6.62, 7.42]} zoom={9} streetViewTarget={mid ? { lat: mid[0], lng: mid[1] } : null}>
      <FitTo selected={selected} all={all} />
      {corridors.flatMap((c) =>
        c.segments.map((s) => {
          const active = selected?.id === s.id;
          const shown = displayLevel(s);
          return (
            <Polyline
              key={`${s.id}-${active}`}
              positions={s.path}
              pathOptions={{ color: shown.color, weight: active ? 9 : 6, opacity: active ? 1 : 0.9, lineCap: "round" }}
              eventHandlers={{ click: () => onSelect(c, s) }}
            >
              <Tooltip sticky>
                {c.name} · {s.label} · {shown.short}
              </Tooltip>
            </Polyline>
          );
        }),
      )}
      {warnings
        .filter((w) => w.status === "corroborated" || w.status === "confirmed")
        .map((w) => (
          <Marker
            key={w.id}
            position={[w.lat, w.lng]}
            icon={icons[w.status as "corroborated" | "confirmed"]}
            eventHandlers={{ click: () => pick(w) }}
            zIndexOffset={1000}
          >
            <Tooltip direction="top" offset={[0, -24]}>
              {w.signs.map((s) => signLabel[s] ?? s).join(" · ")} — {statusMeta[w.status].label.toLowerCase()}
            </Tooltip>
          </Marker>
        ))}
    </BaseMap>
  );
}
