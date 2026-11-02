"use client";

import "leaflet/dist/leaflet.css";

import type { ReactNode } from "react";
import { LayerGroup, LayersControl, MapContainer, TileLayer, ZoomControl } from "react-leaflet";

// Keyless providers. OpenStreetMap's own tiles show estate roads, footpaths and
// farm tracks, which is exactly what off-road reports need. For heavy traffic,
// point NEXT_PUBLIC_MAP_TILES_URL at a paid provider instead.
const STREETS_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export type BaseMapProps = {
  center: [number, number];
  zoom: number;
  children?: ReactNode;
  className?: string;
  /** Satellite helps responders see dirt tracks and bush paths that street maps omit. */
  defaultLayer?: "streets" | "satellite";
};

export default function BaseMap({ center, zoom, children, className, defaultLayer = "streets" }: BaseMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      className={className}
      scrollWheelZoom
      attributionControl
      style={{ height: "100%", width: "100%" }}
    >
      <ZoomControl position="bottomright" />
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
      {children}
    </MapContainer>
  );
}
