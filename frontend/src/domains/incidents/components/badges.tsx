import { cn } from "@/shared/lib/cn";

import type { IncidentStatus, Navigability } from "../types";

const severityClass = ["", "badge-ghost", "badge-ghost", "badge-warning", "badge-primary", "badge-error"];

export function SeverityBadge({ severity, className }: { severity: number | null; className?: string }) {
  if (!severity) return null;
  return (
    <span className={cn("badge badge-sm font-mono tabular", severityClass[severity], className)} title="Severity, 1–5">
      SEV {severity}
    </span>
  );
}

const statusCopy: Record<IncidentStatus, { label: string; tone: string }> = {
  received: { label: "Received", tone: "badge-ghost" },
  verified: { label: "Verified", tone: "badge-success badge-soft" },
  rejected: { label: "Not verified", tone: "badge-neutral badge-soft" },
  dispatched: { label: "Responders paged", tone: "badge-info badge-soft" },
  responding: { label: "Responders en route", tone: "badge-info" },
  resolved: { label: "Resolved", tone: "badge-success" },
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const s = statusCopy[status];
  return <span className={cn("badge badge-sm", s.tone)}>{s.label}</span>;
}

const roadCopy: Record<Navigability, { label: string; tone: string }> = {
  navigable: { label: "Motorable road", tone: "badge-success badge-soft" },
  unnavigable: { label: "Footpath / track", tone: "badge-warning badge-soft" },
  off_network: { label: "Off-road", tone: "badge-warning badge-soft" },
  unknown: { label: "Exact GPS", tone: "badge-ghost" },
};

export function RoadBadge({ navigability }: { navigability: Navigability }) {
  const r = roadCopy[navigability];
  return <span className={cn("badge badge-sm", r.tone)}>{r.label}</span>;
}
