import type { WarningCluster } from "@/domains/roadpulse/types";

export type RoadLevel = "safe" | "caution" | "avoid";

export type Hazard = { type: string; severity: number; note: string };

export type StretchAssessment = {
  scanned_at: string;
  method: "ai" | "imagery";
  exposure_risk: number;
  physical_risk: number;
  vegetation_pct: number | null;
  surface: string | null;
  settlement: string | null;
  hazards: Hazard[];
  summary: string;
  advice: string | null;
  confidence: number | null;
  imagery_date: string | null;
  imagery_res_m: number | null;
};

export type Stretch = {
  id: string;
  seq: number;
  label: string;
  lga: string | null;
  length_m: number;
  path: [number, number][];
  risk: number;
  level: RoadLevel;
  incident_risk: number;
  incidents_90d: number;
  recent_incidents: { ref: string; subtype: string; created_at: string }[];
  warnings: WarningCluster[];
  pulse: { all_clear_3h: number; last_all_clear: string | null; turning_back_1h: number };
  assessment: StretchAssessment | null;
};

export type Corridor = {
  id: string;
  name: string;
  ref: string | null;
  risk: number;
  level: RoadLevel;
  length_km: number;
  reviewed: number;
  segments: Stretch[];
};

export type RoadWatch = {
  generated_at: string;
  last_scan: string | null;
  stretches: number;
  reviewed: number;
  ai_review: boolean;
  window_days: number;
  corridors: Corridor[];
  warnings: WarningCluster[];
};
