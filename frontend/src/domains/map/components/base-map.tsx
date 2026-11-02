"use client";

import "leaflet/dist/leaflet.css";

import type { LeafletEvent, Map as LeafletMap } from "leaflet";
import { PersonStanding } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { CircleMarker, LayerGroup, LayersControl, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

import { cn } from "@/shared/lib/cn";
import { distanceMeters, type LatLng } from "@/shared/lib/geo";

import { STREET_VIEW_ZOOM, type Panorama } from "../street-view";
import { usePanorama } from "../use-panorama";
import { StreetViewPanel } from "./street-view-panel";

// Keyless providers. OpenStreetMap's own tiles show estate roads, footpaths and
// farm tracks, which is exactly what off-road reports need. For heavy traffic,
// point NEXT_PUBLIC_MAP_TILES_URL at a paid provider instead.
const STREETS_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

/** A target further than this from the map centre is off-screen, so Street View follows the centre instead. */
const TARGET_FOLLOW_LIMIT_M = 400;

export type BaseMapProps = {
  center: [number, number];
  zoom: number;
  children?: ReactNode;
  className?: string;
  /** Satellite helps responders see dirt tracks and bush paths that street maps omit. */
  defaultLayer?: "streets" | "satellite";
  /** What Street View should look at when zoomed in (an incident or the report pin). Defaults to the map centre. */
  streetViewTarget?: LatLng | null;
  /** "off" when the parent shows Street View itself, e.g. below a small map where an overlay would hide the pin. */
  streetView?: "overlay" | "off";
  onViewChange?: (view: View) => void;
};

export type View = { zoom: number; center: LatLng };

function ViewTracker({ onChange }: { onChange: (view: View) => void }) {
  const report = (e: LeafletEvent) => {
    const map = e.target as LeafletMap;
    const c = map.getCenter();
    onChange({ zoom: map.getZoom(), center: { lat: c.lat, lng: c.lng } });
  };
  useMapEvents({ zoomend: report, moveend: report });
  return null;
}

/** Where the Street View photo was taken, joined to what it's looking at. */
function CameraPoint({ pano, target }: { pano: Panorama; target: LatLng }) {
  return (
    <>
      {pano.distance > 4 && (
        <Polyline
          positions={[[pano.position.lat, pano.position.lng], [target.lat, target.lng]]}
          pathOptions={{ color: "#f2a93b", weight: 2, dashArray: "4 5" }}
        />
      )}
      <CircleMarker
        center={[pano.position.lat, pano.position.lng]}
        radius={7}
        pathOptions={{ color: "#16181d", weight: 2, fillColor: "#f2a93b", fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -6]}>
          Street View photo taken here
        </Tooltip>
      </CircleMarker>
    </>
  );
}

export default function BaseMap({
  center,
  zoom,
  children,
  className,
  defaultLayer = "streets",
  streetViewTarget,
  streetView = "overlay",
  onViewChange,
}: BaseMapProps) {
  const [view, setView] = useState<View>({ zoom, center: { lat: center[0], lng: center[1] } });
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const onView = useCallback(
    (next: View) => {
      setView(next);
      onViewChange?.(next);
      // Zooming back out resets Street View, so the next zoom-in opens it again.
      if (next.zoom < STREET_VIEW_ZOOM) {
        setDismissed(false);
        setExpanded(false);
      }
    },
    [onViewChange],
  );

  const streetLevel = streetView === "overlay" && view.zoom >= STREET_VIEW_ZOOM;
  const target =
    streetViewTarget && distanceMeters(streetViewTarget, view.center) < TARGET_FOLLOW_LIMIT_M ? streetViewTarget : view.center;
  const open = streetLevel && !dismissed;
  const { lookup, loading } = usePanorama(open ? target : null);
  const pano = open && lookup?.status === "found" ? lookup.pano : null;

  return (
    <div className={cn("@container relative isolate h-full w-full", className)}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom attributionControl style={{ height: "100%", width: "100%" }}>
        <ViewTracker onChange={onView} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked={defaultLayer === "streets"} name="Streets">
            <TileLayer url={STREETS_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} className="tiles-streets" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={defaultLayer === "satellite"} name="Satellite">
            <LayerGroup>
              <TileLayer
                url={`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`}
                attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
                maxZoom={19}
              />
              {/* Road lines and names drawn over the imagery. */}
              <TileLayer url={`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`} maxZoom={19} />
            </LayerGroup>
          </LayersControl.BaseLayer>
        </LayersControl>
        {pano && <CameraPoint pano={pano} target={target} />}
        {children}
      </MapContainer>

      {open && (
        <StreetViewPanel
          variant="overlay"
          target={target}
          lookup={lookup}
          loading={loading}
          expanded={expanded}
          onToggleExpand={() => setExpanded((e) => !e)}
          onClose={() => setDismissed(true)}
        />
      )}
      {streetLevel && dismissed && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="btn btn-sm absolute bottom-7 left-2 z-[1001] gap-1.5 border-base-300 bg-base-100 shadow-md"
        >
          <PersonStanding className="size-4 text-primary" aria-hidden /> Street View
        </button>
      )}
    </div>
  );
}
