import type { PublicIncident } from "@/domains/incidents/types";
import { api } from "@/shared/lib/api-client";

export type Feed = { located: boolean; radius_km: number; items: PublicIncident[] };

export const alertsApi = {
  feed: (pos?: { lat: number; lng: number }) =>
    api<Feed>(`/api/alerts/feed${pos ? `?lat=${pos.lat.toFixed(5)}&lng=${pos.lng.toFixed(5)}` : ""}`),
};
