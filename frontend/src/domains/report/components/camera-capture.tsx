"use client";

import { Camera, ImagePlus, SwitchCamera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { captureFromVideo, fromFile, type EvidencePhoto } from "../lib/photo";

type Props = {
  open: boolean;
  remaining: number;
  lat: number | null;
  lng: number | null;
  onCapture: (photo: EvidencePhoto) => void;
  onClose: () => void;
};

export function CameraCapture({ open, remaining, lat, lng, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera here. Use “Choose photo” instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        const name = (err as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission is blocked. Allow camera access for this site, or choose a photo instead."
            : "The camera couldn't start. Choose a photo instead.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    onCapture(captureFromVideo(video, lat, lng));
    setFlash(true);
    setTimeout(() => setFlash(false), 140);
    if (remaining <= 1) onClose();
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    for (const file of files) onCapture(await fromFile(file, lat, lng));
    e.target.value = "";
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="flex items-center justify-between p-3">
        <button type="button" className="btn btn-circle btn-ghost text-white" onClick={onClose} aria-label="Close camera">
          <X className="size-6" />
        </button>
        <p className="font-mono text-xs uppercase tracking-widest text-white/70">
          {remaining} photo{remaining === 1 ? "" : "s"} left
        </p>
        <button
          type="button"
          className="btn btn-circle btn-ghost text-white"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label="Switch camera"
        >
          <SwitchCamera className="size-6" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-white/80">{error}</div>
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
            onLoadedData={() => setReady(true)}
          />
        )}
        <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? "opacity-70" : "opacity-0"}`} />
        {!error && (
          <p className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] text-white/70">
            Photos are stamped with the time and your GPS position
          </p>
        )}
      </div>

      <div className="flex items-center justify-around px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <button type="button" className="btn btn-ghost gap-2 text-white" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-5" /> Choose photo
        </button>
        <button
          type="button"
          onClick={shoot}
          disabled={!ready || Boolean(error)}
          className="grid size-20 place-items-center rounded-full border-4 border-white/90 disabled:opacity-40"
          aria-label="Take photo"
        >
          <span className="grid size-16 place-items-center rounded-full bg-white text-black">
            <Camera className="size-7" />
          </span>
        </button>
        <span className="w-[7.5rem]" aria-hidden />
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  );
}
