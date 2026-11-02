export type Role = "citizen" | "responder" | "admin";

export type User = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: Role;
  agency_slug: string | null;
  alert_radius_km: number;
  last_lat: number | null;
  last_lng: number | null;
};

export type AuthResponse = { token: string; user: User };
