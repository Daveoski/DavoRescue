export type SignalKind = "warning" | "turning_back" | "all_clear";
export type Sign = "loitering" | "blockade" | "checkpoint" | "traffic_stopped" | "gunshots" | "other";
export type WarningStatus = "unverified" | "corroborated" | "confirmed" | "dismissed";

export type WarningCluster = {
  id: string;
  status: WarningStatus;
  signs: string[];
  sources: number;
  lat: number;
  lng: number;
  segment: { id: string; corridor_name: string; label: string } | null;
  first_seen: string;
  last_seen: string;
  expires_at: string;
  // Responders only
  reports?: { kind: SignalKind; sign: Sign | null; note: string | null; status: WarningStatus; reporter: string; created_at: string }[];
  incident_id?: string | null;
};

export type SignalResult = {
  id: string;
  kind: SignalKind;
  status: WarningStatus | "recorded";
  sources?: number;
  segment: { id: string; corridor_name: string; label: string } | null;
  people_alerted: number;
  message: string;
};

export type TripState = "on_the_way" | "due" | "overdue" | "arrived" | "cancelled";

export type Trip = {
  id: string;
  destination: string;
  eta: string;
  state: TripState;
  contacts: { name: string; phone: string }[];
  share_url: string;
  last_seen_at: string | null;
  created_at: string;
};

export type SharedTrip = {
  traveller: string;
  destination: string;
  eta: string;
  state: TripState;
  started_at: string;
  ended_at: string | null;
  last_position: { lat: number; lng: number } | null;
  last_seen_at: string | null;
};
