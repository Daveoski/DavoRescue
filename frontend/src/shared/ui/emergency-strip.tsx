import { Phone } from "lucide-react";

import { site } from "@/shared/config/site";
import { prettyPhone } from "@/shared/lib/format";

export function EmergencyStrip() {
  return (
    <div className="relative bg-neutral text-neutral-content">
      <div className="hazard absolute inset-y-0 left-0 w-2 sm:w-3" aria-hidden />
      <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-sm">
        <p>
          <span className="font-semibold">Life in danger?</span>{" "}
          <a href={`tel:${site.emergencyLine}`} className="font-mono font-semibold underline decoration-accent decoration-2 underline-offset-4">
            Call 112
          </a>{" "}
          <span className="opacity-70">— free on every network</span>
        </p>
        <a href={`tel:${site.enuguHotline}`} className="hidden items-center gap-1.5 opacity-85 hover:opacity-100 sm:inline-flex">
          <Phone className="size-3.5" aria-hidden />
          Enugu Command &amp; Control <span className="font-mono">{prettyPhone(site.enuguHotline)}</span>
        </a>
      </div>
    </div>
  );
}
