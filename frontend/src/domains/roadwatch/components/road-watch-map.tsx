"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Polyline, Tooltip, useMap } from "react-leaflet";

import BaseMap from "@/domains/map/components/base-map";

import { displayLevel } from "../api";
import type { Corridor, Stretch } from "../types";

type Props = {
  corridors: Corridor[];
  selected: Stretch | null;
  onSelect: (corridor: Corridor, stretch: Stretch) => void;
};

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

export default function RoadWatchMap({ corridors, selected, onSelect }: Props) {
  const all = useMemo(() => corridors.flatMap((c) => c.segments.flatMap((s) => s.path)), [corridors]);
  // Zooming in on a selected stretch points Street View at its middle.
  const mid = selected ? selected.path[Math.floor(selected.path.length / 2)] : null;

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
    </BaseMap>
  );
}
