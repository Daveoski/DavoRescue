import {
  Bomb,
  CarFront,
  Crosshair,
  Flame,
  HeartPulse,
  ShieldAlert,
  TriangleAlert,
  UserX,
  Waves,
  type LucideIcon,
} from "lucide-react";

import type { Category } from "./types";

export type IncidentType = {
  id: string;
  label: string;
  hint: string;
  category: Category;
  subtype: string;
  Icon: LucideIcon;
};

/** What the reporter taps first. Ordered by how often each is reported on South-East roads. */
export const incidentTypes: IncidentType[] = [
  { id: "robbery", label: "Robbery", hint: "Armed men, one-chance, car snatching", category: "crime", subtype: "armed robbery", Icon: ShieldAlert },
  { id: "kidnapping", label: "Kidnapping", hint: "Someone taken or being forced into a vehicle", category: "crime", subtype: "kidnapping", Icon: UserX },
  { id: "shooting", label: "Shooting", hint: "Gunshots, gunmen, cult clash", category: "crime", subtype: "gunshots", Icon: Crosshair },
  { id: "explosion", label: "Explosion", hint: "Blast, bomb, gas or tanker explosion", category: "disaster", subtype: "explosion", Icon: Bomb },
  { id: "fire", label: "Fire", hint: "Building, market, vehicle or bush fire", category: "fire", subtype: "fire", Icon: Flame },
  { id: "medical", label: "Medical", hint: "Unconscious, bleeding, labour, collapse", category: "medical", subtype: "medical emergency", Icon: HeartPulse },
  { id: "crash", label: "Road crash", hint: "Collision, tanker, trailer, hit-and-run", category: "road", subtype: "road crash", Icon: CarFront },
  { id: "flood", label: "Flood / collapse", hint: "Flooded road, erosion, building collapse", category: "disaster", subtype: "flood or collapse", Icon: Waves },
  { id: "other", label: "Other danger", hint: "Anything else putting lives at risk", category: "crime", subtype: "other danger", Icon: TriangleAlert },
];

export const categoryMeta: Record<Category, { label: string; color: string; Icon: LucideIcon }> = {
  crime: { label: "Crime", color: "#d63a1f", Icon: ShieldAlert },
  fire: { label: "Fire", color: "#e9721b", Icon: Flame },
  medical: { label: "Medical", color: "#2a66cf", Icon: HeartPulse },
  road: { label: "Road", color: "#c68a0c", Icon: CarFront },
  disaster: { label: "Disaster", color: "#7c3aed", Icon: Bomb },
};

/** Quick facts responders always ask for; tapping one appends it to the description. */
export const quickFacts = [
  "Still happening now",
  "Armed men",
  "People injured",
  "Someone trapped",
  "Vehicle involved",
  "Road blocked",
  "Attackers fled",
];

export const iconBySubtype: Record<string, LucideIcon> = Object.fromEntries(incidentTypes.map((t) => [t.subtype, t.Icon]));
