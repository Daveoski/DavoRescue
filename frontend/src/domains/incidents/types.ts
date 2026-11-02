export type Category = "crime" | "fire" | "medical" | "road" | "disaster";
export type IncidentStatus = "received" | "verified" | "rejected" | "dispatched" | "responding" | "resolved";
export type Navigability = "navigable" | "unnavigable" | "off_network" | "unknown";

export type PublicIncident = {
  ref: string;
  category: Category;
  subtype: string;
  severity: number | null;
  status: IncidentStatus;
  verified: boolean;
  alert: string | null;
  road_name: string | null;
  navigability: Navigability;
  lga: string | null;
  state: string;
  lat: number;
  lng: number;
  created_at: string;
  verified_at: string | null;
  resolved_at: string | null;
  corroboration_count: number;
  agencies_notified: string[];
  distance_m?: number;
};

export type RoadContext = {
  navigability: Navigability;
  road_name: string | null;
  road_class: string | null;
  access: { lat: number; lng: number; distance_m: number; road_name: string | null } | null;
  address: string | null;
  lga: string | null;
  state: string;
  summary: string;
};

export type DispatchEntry = {
  agency_name: string;
  channel: "sms" | "email" | "webhook" | "push";
  status: "sent" | "failed" | "skipped";
  detail: string | null;
};

export type ReportReceipt = {
  ref: string;
  status: IncidentStatus;
  verdict: "true" | "false";
  verification: {
    source: "ai" | "rules";
    confidence: number;
    severity: number;
    panic_score: number;
    category: Category;
    subtype: string;
    summary: string;
    reasons: string[];
    red_flags: string[];
    evidence_match: string;
  };
  advice: string;
  public_alert: string;
  road: RoadContext;
  dispatches: DispatchEntry[];
  people_alerted: number;
  call_list: { name: string; kind: string; phones: string[] }[];
};

export type ResponderRow = {
  ref: string;
  category: Category;
  subtype: string;
  severity: number | null;
  panic_score: number | null;
  status: IncidentStatus;
  verdict: "true" | "false" | null;
  verification_source: "ai" | "rules" | "human" | null;
  confidence: number | null;
  ai_summary: string | null;
  road_name: string | null;
  navigability: Navigability;
  lga: string | null;
  state: string;
  lat: number;
  lng: number;
  is_anonymous: boolean;
  corroboration_count: number;
  created_at: string;
  photo_count: number;
};

export type ResponderDetail = ResponderRow & {
  id: string;
  description: string;
  injured_count: number | null;
  accuracy_m: number | null;
  road_class: string | null;
  access_lat: number | null;
  access_lng: number | null;
  access_distance_m: number | null;
  address: string | null;
  reporter_contact: string | null;
  reporter: { full_name: string; phone: string } | null;
  ai_reasons: string[];
  ai_red_flags: string[];
  evidence_match: string | null;
  public_alert: string | null;
  dispatch_message: string | null;
  media: { id: string; mime: string; captured_at: string | null; live_capture: boolean }[];
  dispatches: (DispatchEntry & { target: string; created_at: string; agency_slug: string | null })[];
  events: { kind: string; note: string | null; created_at: string; actor: string | null }[];
};
