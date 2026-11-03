import { api } from "@/shared/lib/api-client";

import type { Sign, SignalKind, SignalResult, SharedTrip, Trip, WarningCluster } from "./types";

export const pulseApi = {
  send: (body: { kind: SignalKind; sign?: Sign; note?: string; lat: number; lng: number; accuracy_m?: number | null }) =>
    api<SignalResult>("/api/pulse/signals", { method: "POST", body }),
  warnings: () => api<{ warnings: WarningCluster[] }>("/api/pulse", { auth: false }),
};

export const responderSignalsApi = {
  list: (hours = 12) => api<WarningCluster[]>(`/api/responder/signals?hours=${hours}`),
  review: (id: string, action: "confirm" | "dismiss" | "escalate", note?: string) =>
    api<{ id: string; status: string; incident_ref?: string; people_alerted?: number }>(`/api/responder/signals/${id}`, {
      method: "PATCH",
      body: { action, note },
    }),
};

export const tripsApi = {
  start: (body: { destination: string; eta_minutes: number; contacts: { name: string; phone: string }[] }) =>
    api<Trip>("/api/trips", { method: "POST", body }),
  active: () => api<{ trip: Trip | null }>("/api/trips/active"),
  ping: (id: string, lat: number, lng: number) => api<Trip>(`/api/trips/${id}/ping`, { method: "POST", body: { lat, lng } }),
  arrived: (id: string) => api<Trip>(`/api/trips/${id}/arrived`, { method: "POST" }),
  cancel: (id: string) => api<Trip>(`/api/trips/${id}/cancel`, { method: "POST" }),
  extend: (id: string, minutes: number) => api<Trip>(`/api/trips/${id}/extend`, { method: "POST", body: { minutes } }),
  shared: (token: string) => api<SharedTrip>(`/api/trips/shared/${encodeURIComponent(token)}`, { auth: false }),
};
