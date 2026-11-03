import { api } from "@/shared/lib/api-client";

import type { RoadWatch, Stretch } from "./types";

export const roadWatchApi = {
  get: () => api<RoadWatch>("/api/roadwatch", { auth: false }),
  /** Admins only: review the next batch of stretches now. */
  scan: (limit = 10) =>
    api<{ reviewed: { segment: string; method: string }[]; failed: { segment: string; error: string }[] }>(
      `/api/roadwatch/scan?limit=${limit}`,
      { method: "POST" },
    ),
};

export const levelMeta = {
  safe: { label: "Normal caution", short: "Safe", color: "#15805a", badge: "badge-success" },
  caution: { label: "Travel with caution", short: "Caution", color: "#e2a012", badge: "badge-warning" },
  avoid: { label: "Avoid if you can", short: "Avoid", color: "#c4241a", badge: "badge-error" },
} as const;

export const UNREVIEWED_COLOR = "#8a8f98";

export type DisplayLevel = { key: "safe" | "caution" | "avoid" | "pending"; label: string; short: string; color: string; badge: string };

/**
 * A stretch with no reports and no AI review hasn't been shown to be safe — we just
 * have no evidence either way — so it stays grey instead of green.
 */
export function displayLevel(s: Stretch): DisplayLevel {
  const evidence = s.incidents_90d > 0 || s.assessment?.method === "ai";
  if (!evidence && s.level === "safe") {
    return { key: "pending", label: "No reports · AI review pending", short: "Pending", color: UNREVIEWED_COLOR, badge: "badge-ghost" };
  }
  return { key: s.level, ...levelMeta[s.level] };
}

export const hazardLabel: Record<string, string> = {
  erosion: "Erosion",
  flooding: "Flooding",
  surface_damage: "Damaged surface",
  narrowing: "Narrowing",
  bridge: "Bridge",
  obstruction: "Obstruction",
  burn_scar: "Burn scar",
  other: "Other",
};

export const settlementLabel: Record<string, string> = {
  urban: "Built-up",
  peri_urban: "Edge of town",
  rural: "Rural",
  isolated: "Isolated",
};

export const surfaceLabel: Record<string, string> = {
  paved_good: "Paved, good",
  paved_worn: "Paved, worn",
  unpaved: "Unpaved",
  mixed: "Mixed surface",
  unclear: "Surface unclear",
};
