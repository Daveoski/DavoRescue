"use client";

import "mapillary-js/dist/mapillary.css";

import type { Viewer } from "mapillary-js";
import { useEffect, useRef } from "react";

import type { LatLng } from "@/shared/lib/geo";

import { MAPILLARY_TOKEN } from "../street-view";

type Props = {
  imageId: string;
  /** Fires as the user walks to neighbouring photos, so the map can follow. */
  onMove?: (image: { id: string; position: LatLng }) => void;
};

/** Interactive Mapillary street-level viewer. Loaded only in the browser (WebGL). */
export default function MapillaryViewer({ imageId, onMove }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const latestId = useRef(imageId);
  const latestOnMove = useRef(onMove);

  useEffect(() => {
    latestId.current = imageId;
    latestOnMove.current = onMove;
  });

  // Create the viewer once; later image changes go through moveTo for a smooth transition.
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    import("mapillary-js").then(({ Viewer }) => {
      if (disposed || !container.current) return;
      const v = new Viewer({
        accessToken: MAPILLARY_TOKEN,
        container: container.current,
        imageId: latestId.current,
        component: { cover: false },
      });
      v.on("image", (event) => {
        const { lat, lng } = event.image.computedLngLat ?? event.image.lngLat;
        latestOnMove.current?.({ id: event.image.id, position: { lat, lng } });
      });
      // The panel can grow and shrink without a window resize.
      observer = new ResizeObserver(() => v.resize());
      observer.observe(container.current);
      viewer.current = v;
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      viewer.current?.remove();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    viewer.current?.moveTo(imageId).catch(() => undefined);
  }, [imageId]);

  // Inline sizing on purpose: mapillary.css sets `position: relative` on the
  // container and, being unlayered CSS, would beat Tailwind's utility classes,
  // collapsing the viewer to zero height.
  return <div ref={container} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
