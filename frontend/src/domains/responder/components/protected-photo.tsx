"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/domains/auth/store";

/** Evidence photos are responder-only, so they're fetched with the bearer token and shown from a blob URL. */
export function ProtectedPhoto({ src, alt }: { src: string; alt: string }) {
  const token = useAuth((s) => s.token);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, token]);

  if (failed) return <div className="grid aspect-[4/3] place-items-center rounded-field bg-base-200 text-xs">Photo unavailable</div>;
  if (!url) return <div className="skeleton aspect-[4/3] w-full" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="aspect-[4/3] w-full rounded-field object-cover" />
    </a>
  );
}
