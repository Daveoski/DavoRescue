"use client";

import { RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { useAuth, useSessionReady } from "@/domains/auth/store";
import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";
import { timeAgo } from "@/shared/lib/format";
import { usePoll } from "@/shared/lib/use-poll";

import { displayLevel, levelMeta, roadWatchApi, UNREVIEWED_COLOR, type DisplayLevel } from "../api";
import type { Corridor, RoadWatch, Stretch } from "../types";
import { StretchDetail } from "./stretch-detail";

const RoadWatchMap = dynamic(() => import("./road-watch-map"), {
  ssr: false,
  loading: () => <div className="grid-paper h-full w-full bg-base-200" aria-busy="true" />,
});

function Strip({ corridor, selected, onSelect }: { corridor: Corridor; selected: Stretch | null; onSelect: (s: Stretch) => void }) {
  return (
    <div className="flex gap-0.5" role="list" aria-label={`${corridor.name} stretches`}>
      {corridor.segments.map((s) => {
        const shown = displayLevel(s);
        return (
          <button
            key={s.id}
            type="button"
            role="listitem"
            onClick={() => onSelect(s)}
            title={`${s.label} · ${shown.short}`}
            aria-label={`Stretch ${s.seq}, ${s.label}: ${shown.label}`}
            className={cn("h-3 flex-1 rounded-[2px] transition-transform hover:scale-y-150", selected?.id === s.id && "ring-2 ring-base-content")}
            style={{ background: shown.color }}
          />
        );
      })}
    </div>
  );
}

export function RoadWatchBoard() {
  const ready = useSessionReady();
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [data, setData] = useState<RoadWatch | null>(null);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState<{ corridorId: string; stretchId: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const load = async () => {
    try {
      setData(await roadWatchApi.get());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  usePoll(load, 300_000);

  async function scanNow() {
    setScanning(true);
    setScanNote(null);
    try {
      const result = await roadWatchApi.scan();
      setScanNote(`Reviewed ${result.reviewed.length} stretch${result.reviewed.length === 1 ? "" : "es"}${result.failed.length ? `, ${result.failed.length} failed` : ""}.`);
      await load();
    } catch (err) {
      setScanNote((err as ApiError).message);
    } finally {
      setScanning(false);
    }
  }

  const corridor = data?.corridors.find((c) => c.id === selection?.corridorId) ?? null;
  const stretch = corridor?.segments.find((s) => s.id === selection?.stretchId) ?? null;
  const select = (c: Corridor, s: Stretch) => setSelection({ corridorId: c.id, stretchId: s.id });

  if (failed && !data) return <p className="wrap py-10">Road Watch couldn’t load. Check your connection — we’ll keep retrying.</p>;

  const counts = data
    ? data.corridors.flatMap((c) => c.segments).reduce(
        (acc, s) => {
          const key = displayLevel(s).key;
          return { ...acc, [key]: acc[key] + 1 };
        },
        { safe: 0, caution: 0, avoid: 0, pending: 0 } as Record<DisplayLevel["key"], number>,
      )
    : null;
  const legend: { key: DisplayLevel["key"]; label: string; color: string }[] = [
    { key: "avoid", label: "avoid", color: levelMeta.avoid.color },
    { key: "caution", label: "caution", color: levelMeta.caution.color },
    { key: "safe", label: "safe", color: levelMeta.safe.color },
    { key: "pending", label: "awaiting evidence", color: UNREVIEWED_COLOR },
  ];

  function corridorBadge(c: Corridor) {
    const shown = c.segments.map(displayLevel);
    if (shown.some((d) => d.key === "avoid")) return { text: "Has avoid stretches", badge: levelMeta.avoid.badge };
    if (shown.some((d) => d.key === "caution")) return { text: "Has caution stretches", badge: levelMeta.caution.badge };
    if (shown.every((d) => d.key === "pending")) return { text: "Awaiting evidence", badge: "badge-ghost" };
    return { text: "No hotspots", badge: levelMeta.safe.badge };
  }

  return (
    <div className="grid lg:h-[calc(100dvh-6.5rem)] lg:grid-cols-[440px_minmax(0,1fr)]">
      <aside className="order-2 flex min-h-0 flex-col border-base-300 lg:order-1 lg:border-r">
        <div className="space-y-3 border-b border-base-300 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold">Road Watch</h1>
              <p className="text-sm text-base-content/65">Enugu’s major roads, stretch by stretch.</p>
            </div>
            {ready && isAdmin && (
              <button type="button" className="btn btn-sm gap-1.5" onClick={scanNow} disabled={scanning}>
                {scanning ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw className="size-3.5" />}
                Scan next 10
              </button>
            )}
          </div>
          {counts && (
            <div className="flex flex-wrap gap-2 text-xs">
              {legend.map((l) => (
                <span key={l.key} className="inline-flex items-center gap-1.5 rounded-full border border-base-300 px-2.5 py-1">
                  <span className="size-2.5 rounded-full" style={{ background: l.color }} />
                  {counts[l.key]} {l.label}
                </span>
              ))}
            </div>
          )}
          {data && (
            <p className="text-xs text-base-content/55">
              {data.reviewed} of {data.stretches} stretches reviewed
              {data.last_scan && ` · last scan ${timeAgo(data.last_scan)}`}
              {!data.ai_review && " · AI review not switched on yet"}
            </p>
          )}
          {scanNote && <p className="rounded-field bg-base-200 px-3 py-2 text-xs">{scanNote}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {stretch && corridor ? (
            <div className="p-4">
              <StretchDetail corridor={corridor} stretch={stretch} onClose={() => setSelection(null)} />
            </div>
          ) : !data ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-base-300">
              {data.corridors.map((c) => (
                <li key={c.id} className="space-y-2.5 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold leading-tight">{c.name}</p>
                      <p className="text-xs text-base-content/55">
                        {c.ref && `${c.ref} · `}
                        {c.length_km} km in Enugu · {c.segments.length} stretches
                      </p>
                    </div>
                    <span className={cn("badge badge-sm shrink-0", corridorBadge(c).badge)}>{corridorBadge(c).text}</span>
                  </div>
                  <Strip corridor={c} selected={stretch} onSelect={(s) => select(c, s)} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-base-300 p-4 text-xs leading-relaxed text-base-content/60">
            <p className="font-semibold text-base-content/80">How roads are rated</p>
            <p className="mt-1">
              Verified incident reports from the last 90 days near each stretch carry the most weight. An AI model also reviews
              recent satellite imagery of every stretch for physical hazards (erosion, flooding, broken surface) and isolation (thick
              bush, no settlements nearby) — a known risk factor for highway robbery and kidnapping. Satellite photos are not live:
              they can be months old and never show crimes or roadblocks as they happen. If you see danger, report it.
            </p>
          </div>
        </div>
      </aside>

      <div className="order-1 h-[55dvh] lg:order-2 lg:h-auto">
        {data && <RoadWatchMap corridors={data.corridors} selected={stretch} onSelect={select} />}
      </div>
    </div>
  );
}
