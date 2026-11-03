import type { TripState } from "../types";

export const tripStateMeta: Record<TripState, { label: string; panel: string }> = {
  on_the_way: { label: "On the way", panel: "bg-neutral text-neutral-content" },
  due: { label: "Due now", panel: "bg-warning text-warning-content" },
  overdue: { label: "Overdue — hasn’t checked in", panel: "bg-error text-error-content" },
  arrived: { label: "Arrived safely", panel: "bg-success text-success-content" },
  cancelled: { label: "Trip ended", panel: "bg-base-200 text-base-content" },
};
