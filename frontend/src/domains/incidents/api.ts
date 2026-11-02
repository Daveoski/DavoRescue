import { api } from "@/shared/lib/api-client";

import type { IncidentStatus, PublicIncident, ReportReceipt, ResponderDetail, ResponderRow, RoadContext } from "./types";

export type ReportPayload = {
  category: string;
  subtype: string;
  description: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  injured_count: number | null;
  anonymous: boolean;
  contact_phone: string | null;
  photos: { data_url: string; captured_at: string; lat: number | null; lng: number | null; live_capture: boolean }[];
};

export type Stats = {
  reports_24h: number;
  verified_30d: number;
  rejected_30d: number;
  median_verify_s: number | null;
  agencies: number;
};

export const incidentsApi = {
  report: (body: ReportPayload) => api<ReportReceipt>("/api/incidents", { method: "POST", body }),
  live: (params: { hours?: number; state?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.hours) q.set("hours", String(params.hours));
    if (params.state) q.set("state", params.state);
    return api<PublicIncident[]>(`/api/incidents?${q}`, { auth: false });
  },
  get: (ref: string) => api<PublicIncident>(`/api/incidents/${encodeURIComponent(ref)}`, { auth: false }),
  stats: () => api<Stats>("/api/incidents/stats", { auth: false }),
  roadContext: (lat: number, lng: number) =>
    api<RoadContext>(`/api/roads/context?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { auth: false }),
};

export const responderApi = {
  queue: (params: { status?: IncidentStatus[]; hours?: number; state?: string } = {}) => {
    const q = new URLSearchParams();
    params.status?.forEach((s) => q.append("status", s));
    if (params.hours) q.set("hours", String(params.hours));
    if (params.state) q.set("state", params.state);
    return api<ResponderRow[]>(`/api/responder/incidents?${q}`);
  },
  detail: (ref: string) => api<ResponderDetail>(`/api/responder/incidents/${ref}`),
  setStatus: (ref: string, status: IncidentStatus, note?: string) =>
    api<ResponderDetail>(`/api/responder/incidents/${ref}`, { method: "PATCH", body: { status, note } }),
};
