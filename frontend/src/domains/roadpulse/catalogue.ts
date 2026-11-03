import { Ban, Car, Crosshair, EyeOff, HelpCircle, ShieldAlert, Undo2, type LucideIcon } from "lucide-react";

import type { Sign, WarningStatus } from "./types";

export const signs: { id: Sign; label: string; Icon: LucideIcon }[] = [
  { id: "loitering", label: "People hiding or loitering by the road", Icon: EyeOff },
  { id: "blockade", label: "Road blocked or a vehicle across the road", Icon: Ban },
  { id: "checkpoint", label: "Unofficial checkpoint", Icon: ShieldAlert },
  { id: "traffic_stopped", label: "Traffic suddenly stopped", Icon: Car },
  { id: "gunshots", label: "Gunshots nearby", Icon: Crosshair },
  { id: "other", label: "Something else suspicious", Icon: HelpCircle },
];

export const signLabel: Record<string, string> = {
  ...Object.fromEntries(signs.map((s) => [s.id, s.label])),
  turning_back: "Vehicles turning back",
};

export const TurningBackIcon = Undo2;

export const statusMeta: Record<WarningStatus, { label: string; badge: string; color: string }> = {
  unverified: { label: "Unverified", badge: "badge-ghost", color: "#8a8f98" },
  corroborated: { label: "Corroborated", badge: "badge-warning", color: "#e2a012" },
  confirmed: { label: "Confirmed by responders", badge: "badge-error", color: "#c4241a" },
  dismissed: { label: "Dismissed", badge: "badge-ghost", color: "#8a8f98" },
};
