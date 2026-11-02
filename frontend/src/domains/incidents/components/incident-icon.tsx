import { categoryMeta, iconBySubtype } from "../catalogue";
import type { Category } from "../types";

export function IncidentIcon({ category, subtype, className }: { category: Category; subtype: string; className?: string }) {
  const Icon = iconBySubtype[subtype] ?? categoryMeta[category].Icon;
  return <Icon className={className} aria-hidden />;
}
