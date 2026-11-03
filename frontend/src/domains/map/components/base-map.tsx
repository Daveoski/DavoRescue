"use client";

import "leaflet/dist/leaflet.css";

import L, { type LeafletEvent, type Map as LeafletMap } from "leaflet";
import { PersonStanding } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleMarker, LayerGroup, LayersControl, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

import { cn } from "@/shared/lib/cn";
import { distanceMeters, type LatLng } from "@/shared/lib/geo";

import { COVERAGE_ZOOM, STREET_VIEW_ZOOM, streetViewEnabled, type Bounds, type StreetImage } from "../street-view";
import { useStreetCoverage, useStreetView } from "../use-street-image";
import { StreetViewPanel } from "./street-view-panel";

// Keyless providers. OpenStreetMap's own tiles show estate roads, footpaths and
// farm tracks, which is exactly what off-road reports need. For heavy traffic,
// point NEXT_PUBLIC_MAP_TILES_URL at a paid provider instead.
const STREETS_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const MAPILLARY_GREEN = "#05cb63";

/** A target further than this from the map centre is off-screen, so Street View follows the centre instead. */
const TARGET_FOLLOW_LIMIT_M = 400;

export type View = { zoom: number; center: LatLng; bounds: Bounds };

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
  /** Called when someone taps a street-photo dot (used when the parent shows the viewer). */
  onStreetImagePick?: (image: StreetImage) => void;
};

function readView(map: LeafletMap): View {
  const c = map.getCenter();
  const b = map.getBounds();
  return {
    zoom: map.getZoom(),
    center: { lat: c.lat, lng: c.lng },
    bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
  };
}

function ViewTracker({ onChange }: { onChange: (view: View) => void }) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  const report = (e: LeafletEvent) => latest.current(readView(e.target as LeafletMap));
  const map = useMapEvents({ zoomend: report, moveend: report });
  // The map's "load" fires before these handlers attach, so report the starting view once it's ready.
  useEffect(() => {
    map.whenReady(() => latest.current(readView(map)));
  }, [map]);
  return null;
}

/** Where the street photo was taken, joined to what it's looking at. */
function CameraPoint({ position, target }: { position: LatLng; target: LatLng }) {
  return (
    <>
      {distanceMeters(position, target) > 4 && (
        <Polyline
          positions={[[position.lat, position.lng], [target.lat, target.lng]]}
          pathOptions={{ color: "#f2a93b", weight: 2, dashArray: "4 5" }}
        />
      )}
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={7}
        pathOptions={{ color: "#16181d", weight: 2, fillColor: "#f2a93b", fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -6]}>
          Street photo taken here
        </Tooltip>
      </CircleMarker>
    </>
  );
}

const keyOf = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export default function BaseMap({
  center,
  zoom,
  children,
  className,
  defaultLayer = "streets",
  streetViewTarget,
  streetView = "overlay",
  onViewChange,
  onStreetImagePick,
}: BaseMapProps) {
  const [view, setView] = useState<View | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pick, setPick] = useState<{ image: StreetImage; forTarget: string } | null>(null);
  const [walk, setWalk] = useState<{ startId: string; position: LatLng } | null>(null);
  // Hundreds of photo dots draw far faster on one canvas than as SVG elements.
  const dotsRenderer = useMemo(() => L.canvas({ padding: 0.3 }), []);

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

  const currentZoom = view?.zoom ?? zoom;
  const centre = view?.center ?? { lat: center[0], lng: center[1] };
  const streetLevel = currentZoom >= STREET_VIEW_ZOOM;
  const followsTarget = Boolean(streetViewTarget && distanceMeters(streetViewTarget, centre) < TARGET_FOLLOW_LIMIT_M);
  const target = followsTarget && streetViewTarget ? streetViewTarget : centre;

  const overlay = streetView === "overlay";
  const open = overlay && streetLevel && !dismissed;
  const sv = useStreetView(open ? target : null);
  // A tapped photo stays on screen until the thing being looked at moves.
  const picked = pick?.forTarget === keyOf(target) ? pick.image : null;
  const mapillaryShown = open ? (picked ?? (sv.mapillary.lookup?.status === "found" ? sv.mapillary.lookup.image : null)) : null;
  const googleShown = open && sv.google.lookup?.status === "found" ? sv.google.lookup.pano : null;
  const activeSource = picked ? "mapillary" : sv.source;
  const cameraPosition =
    activeSource === "google"
      ? (googleShown?.position ?? null)
      : mapillaryShown
        ? walk?.startId === mapillaryShown.id
          ? walk.position
          : mapillaryShown.position
        : null;

  const dots = useStreetCoverage(streetViewEnabled && currentZoom >= COVERAGE_ZOOM && view ? view.bounds : null);

  function pickImage(image: StreetImage) {
    if (overlay) {
      setPick({ image, forTarget: keyOf(target) });
      sv.setSource("mapillary");
      setDismissed(false);
    }
    onStreetImagePick?.(image);
  }

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

        {/* Green dots: every spot with a street photo. At street level, tap one to look from there. */}
        {dots
          .filter((d) => d.id !== mapillaryShown?.id)
          .map((d) => (
            <CircleMarker
              // Interactivity is fixed when a Leaflet layer is created, so remount when it changes.
              key={`${d.id}-${streetLevel}`}
              center={[d.position.lat, d.position.lng]}
              radius={streetLevel ? 4 : 3}
              renderer={dotsRenderer}
              interactive={streetLevel}
              bubblingMouseEvents={false}
              pathOptions={{ color: "#ffffff", weight: 1, fillColor: MAPILLARY_GREEN, fillOpacity: 0.95 }}
              eventHandlers={{ click: () => pickImage(d) }}
            />
          ))}

        {cameraPosition && <CameraPoint position={cameraPosition} target={target} />}
        {children}
      </MapContainer>

      {open && (
        <StreetViewPanel
          variant="overlay"
          target={target}
          subject={followsTarget ? "incident" : "map centre"}
          view={sv}
          picked={picked}
          expanded={expanded}
          onToggleExpand={() => setExpanded((e) => !e)}
          onClose={() => setDismissed(true)}
          onWalk={(step) => mapillaryShown && setWalk({ startId: mapillaryShown.id, position: step.position })}
        />
      )}
      {overlay && streetLevel && dismissed && (
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
