import { api } from "@/shared/lib/api-client";

import type { RoadWatch } from "./types";

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
