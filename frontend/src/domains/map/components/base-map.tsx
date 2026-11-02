"use client";

import "leaflet/dist/leaflet.css";

import { useSyncExternalStore, type ReactNode } from "react";
import { LayersControl, MapContainer, TileLayer, ZoomControl } from "react-leaflet";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function subscribeDark(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function usePrefersDark() {
  return useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

export type BaseMapProps = {
  center: [number, number];
  zoom: number;
  children?: ReactNode;
  className?: string;
  /** Satellite helps responders see dirt tracks and bush paths that street maps omit. */
  defaultLayer?: "streets" | "satellite";
};

export default function BaseMap({ center, zoom, children, className, defaultLayer = "streets" }: BaseMapProps) {
  const dark = usePrefersDark();
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
          <TileLayer
            key={dark ? "dark" : "light"}
            url={
              dark
                ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
            }
            attribution={`${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`}
            maxZoom={20}
            subdomains="abcd"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked={defaultLayer === "satellite"} name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        {/* Labels sit on their own layer so they stay readable over satellite imagery too. */}
        <LayersControl.Overlay checked name="Road names">
          <TileLayer
            key={dark ? "labels-dark" : "labels-light"}
            url={
              dark
                ? "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
            }
            subdomains="abcd"
            maxZoom={20}
            zIndex={10}
          />
        </LayersControl.Overlay>
      </LayersControl>
      {children}
    </MapContainer>
  );
}
