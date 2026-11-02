export type EvidencePhoto = {
  id: string;
  dataUrl: string;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  live: boolean;
};

const MAX_EDGE = 1280;
const QUALITY = 0.72;

function stampText(at: Date, lat: number | null, lng: number | null, live: boolean): string {
  const time = at.toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const where = lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "no GPS";
  return `DavoRescue · ${live ? "live capture" : "uploaded"} · ${time} WAT · ${where}`;
}

/**
 * Draw a source onto a canvas no larger than MAX_EDGE, burn in a time/GPS
 * strip, and export a compressed JPEG. The stamp lets responders see at a
 * glance when and where a picture was taken.
 */
function render(
  source: CanvasImageSource,
  width: number,
  height: number,
  meta: { at: Date; lat: number | null; lng: number | null; live: boolean },
): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0, w, h);

  const band = Math.max(22, Math.round(h * 0.045));
  ctx.fillStyle = "rgba(16, 18, 22, 0.72)";
  ctx.fillRect(0, h - band, w, band);
  ctx.fillStyle = "#f2a93b";
  ctx.fillRect(0, h - band, Math.max(4, Math.round(w * 0.006)), band);
  ctx.font = `500 ${Math.round(band * 0.5)}px ui-monospace, "IBM Plex Mono", monospace`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(stampText(meta.at, meta.lat, meta.lng, meta.live), Math.round(band * 0.6), h - band / 2, w - band);

  return canvas.toDataURL("image/jpeg", QUALITY);
}

export function captureFromVideo(video: HTMLVideoElement, lat: number | null, lng: number | null): EvidencePhoto {
  const at = new Date();
  return {
    id: crypto.randomUUID(),
    dataUrl: render(video, video.videoWidth, video.videoHeight, { at, lat, lng, live: true }),
    capturedAt: at.toISOString(),
    lat,
    lng,
    live: true,
  };
}

export async function fromFile(file: File, lat: number | null, lng: number | null): Promise<EvidencePhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const at = new Date();
    return {
      id: crypto.randomUUID(),
      dataUrl: render(bitmap, bitmap.width, bitmap.height, { at, lat, lng, live: false }),
      capturedAt: at.toISOString(),
      lat,
      lng,
      live: false,
    };
  } finally {
    bitmap.close();
  }
}
