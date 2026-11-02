import { api } from "@/shared/lib/api-client";

import type { AuthResponse, User } from "./types";

export const authApi = {
  signIn: (body: { identifier: string; password: string }) =>
    api<AuthResponse>("/api/auth/login", { method: "POST", body, auth: false }),
  signUp: (body: {
    full_name: string;
    phone: string;
    email: string | null;
    password: string;
    invite_code?: string;
    agency_slug?: string;
  }) => api<AuthResponse>("/api/auth/register", { method: "POST", body, auth: false }),
  me: () => api<User>("/api/auth/me"),
  update: (body: { alert_radius_km?: number; lat?: number; lng?: number }) =>
    api<User>("/api/auth/me", { method: "PATCH", body }),
};
